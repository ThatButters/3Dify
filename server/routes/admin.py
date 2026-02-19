import hmac
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Header, Request
from pydantic import BaseModel
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_session
from models.audit_log import AuditLog
from models.ban import IPBan
from models.job import Job, JobStatus
from services import queue
from services.worker_bridge import WorkerBridge

router = APIRouter(prefix="/admin")


def _verify_admin(authorization: str = Header(...)):
    expected = f"Bearer {settings.admin_auth_token}"
    if not hmac.compare_digest(authorization, expected):
        raise HTTPException(401, "Invalid admin token")


def _get_bridge(request: Request) -> WorkerBridge:
    return request.app.state.worker_bridge


# ─── Dashboard ─────────────────────────────────────────────────

@router.get("/dashboard", dependencies=[Depends(_verify_admin)])
async def dashboard(
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    bridge = _get_bridge(request)
    summary = await queue.get_queue_summary(session)

    # Total jobs & average time
    result = await session.execute(
        select(func.count(), func.avg(Job.generation_time_s))
        .select_from(Job)
        .where(Job.status == JobStatus.complete)
    )
    row = result.one()
    total_complete = row[0]
    avg_time = round(row[1], 1) if row[1] else None

    return {
        "worker": {
            "connected": bridge.worker_connected,
            "info": bridge.worker_info,
            "gpu_status": bridge.gpu_status,
            "paused": bridge.paused,
        },
        "queue": summary,
        "stats": {
            "total_completed": total_complete,
            "avg_generation_time_s": avg_time,
        },
    }


# ─── Worker commands ───────────────────────────────────────────

@router.post("/pause", dependencies=[Depends(_verify_admin)])
async def pause_worker(request: Request):
    bridge = _get_bridge(request)
    bridge.paused = True
    await bridge.send_command("pause")
    return {"status": "paused"}


@router.post("/resume", dependencies=[Depends(_verify_admin)])
async def resume_worker(request: Request):
    bridge = _get_bridge(request)
    bridge.paused = False
    await bridge.send_command("resume")
    return {"status": "resumed"}


@router.post("/force/{job_id}", dependencies=[Depends(_verify_admin)])
async def force_process(request: Request, job_id: str):
    bridge = _get_bridge(request)
    sent = await bridge.send_command("force_process", job_id)
    if not sent:
        raise HTTPException(503, "Worker not connected")
    return {"status": "force_process sent"}


# ─── IP Ban CRUD ───────────────────────────────────────────────

class BanCreate(BaseModel):
    ip_or_cidr: str
    reason: str | None = None


@router.get("/bans", dependencies=[Depends(_verify_admin)])
async def list_bans(session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(IPBan))
    bans = result.scalars().all()
    return [{"id": b.id, "ip_or_cidr": b.ip_or_cidr, "reason": b.reason, "created_at": b.created_at.isoformat()} for b in bans]


@router.post("/bans", dependencies=[Depends(_verify_admin)])
async def create_ban(body: BanCreate, session: AsyncSession = Depends(get_session)):
    ban = IPBan(ip_or_cidr=body.ip_or_cidr, reason=body.reason)
    session.add(ban)
    await session.commit()
    await session.refresh(ban)
    return {"id": ban.id, "ip_or_cidr": ban.ip_or_cidr}


@router.delete("/bans/{ban_id}", dependencies=[Depends(_verify_admin)])
async def delete_ban(ban_id: int, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(IPBan).where(IPBan.id == ban_id))
    ban = result.scalar_one_or_none()
    if not ban:
        raise HTTPException(404, "Ban not found")
    await session.delete(ban)
    await session.commit()
    return {"deleted": True}


# ─── Audit log ─────────────────────────────────────────────────

@router.get("/audit-log", dependencies=[Depends(_verify_admin)])
async def audit_log(
    limit: int = 50,
    offset: int = 0,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    logs = result.scalars().all()
    return [
        {
            "id": l.id,
            "action": l.action,
            "client_ip": l.client_ip,
            "job_id": l.job_id,
            "detail": l.detail,
            "created_at": l.created_at.isoformat(),
        }
        for l in logs
    ]


# ─── Stats ─────────────────────────────────────────────────────

@router.get("/stats", dependencies=[Depends(_verify_admin)])
async def stats(session: AsyncSession = Depends(get_session)):
    now = datetime.now(timezone.utc)

    # Jobs in last 24h
    cutoff_24h = now - timedelta(hours=24)
    result = await session.execute(
        select(func.count()).select_from(Job).where(Job.created_at >= cutoff_24h)
    )
    jobs_24h = result.scalar_one()

    # Unique IPs in last 24h
    result = await session.execute(
        select(func.count(func.distinct(Job.client_ip)))
        .select_from(Job)
        .where(Job.created_at >= cutoff_24h)
    )
    unique_ips_24h = result.scalar_one()

    # Failure rate
    result = await session.execute(
        select(func.count()).select_from(Job).where(Job.status == JobStatus.failed)
    )
    failed = result.scalar_one()
    result = await session.execute(select(func.count()).select_from(Job))
    total = result.scalar_one()

    return {
        "jobs_24h": jobs_24h,
        "unique_ips_24h": unique_ips_24h,
        "total_jobs": total,
        "total_failed": failed,
        "failure_rate": round(failed / total, 3) if total else 0,
    }
