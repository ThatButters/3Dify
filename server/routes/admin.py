import hmac
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Header, Query, Request
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

router = APIRouter(prefix="/api/admin")


def _verify_admin(authorization: str = Header(...)):
    expected = f"Bearer {settings.admin_auth_token}"
    if not hmac.compare_digest(authorization, expected):
        raise HTTPException(401, "Invalid admin token")


def _get_bridge(request: Request) -> WorkerBridge:
    return request.app.state.worker_bridge


# ─── Login (no auth required) ────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
async def admin_login(body: LoginRequest):
    if (hmac.compare_digest(body.username, settings.admin_username)
            and hmac.compare_digest(body.password, settings.admin_password)):
        return {"token": settings.admin_auth_token}
    raise HTTPException(401, "Invalid credentials")


# ─── Worker status & GPU ──────────────────────────────────────

@router.get("/worker/status", dependencies=[Depends(_verify_admin)])
async def worker_status(request: Request):
    bridge = _get_bridge(request)
    return {
        "connected": bridge.worker_connected,
        "info": bridge.worker_info,
        "paused": bridge.paused,
    }


@router.get("/gpu", dependencies=[Depends(_verify_admin)])
async def gpu_status(request: Request):
    bridge = _get_bridge(request)
    return bridge.gpu_status or {}


@router.post("/worker/pause", dependencies=[Depends(_verify_admin)])
async def pause_worker(request: Request):
    bridge = _get_bridge(request)
    bridge.paused = True
    await bridge.send_command("pause")
    return {"status": "paused"}


@router.post("/worker/resume", dependencies=[Depends(_verify_admin)])
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


# ─── Dashboard ─────────────────────────────────────────────────

@router.get("/dashboard", dependencies=[Depends(_verify_admin)])
async def dashboard(
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    bridge = _get_bridge(request)
    summary = await queue.get_queue_summary(session)

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


# ─── Jobs ─────────────────────────────────────────────────────

@router.get("/jobs", dependencies=[Depends(_verify_admin)])
async def list_jobs(
    session: AsyncSession = Depends(get_session),
    status: str | None = None,
    search: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    stmt = select(Job)
    count_stmt = select(func.count()).select_from(Job)

    if status:
        stmt = stmt.where(Job.status == status)
        count_stmt = count_stmt.where(Job.status == status)
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(
            Job.id.ilike(pattern) | Job.original_filename.ilike(pattern) | Job.client_ip.ilike(pattern)
        )
        count_stmt = count_stmt.where(
            Job.id.ilike(pattern) | Job.original_filename.ilike(pattern) | Job.client_ip.ilike(pattern)
        )

    total = (await session.execute(count_stmt)).scalar_one()
    offset = (page - 1) * limit
    result = await session.execute(
        stmt.order_by(Job.created_at.desc()).offset(offset).limit(limit)
    )
    jobs = result.scalars().all()

    return {
        "jobs": [
            {
                "id": j.id,
                "status": j.status,
                "original_filename": j.original_filename,
                "client_ip": j.client_ip,
                "vertex_count": j.vertex_count,
                "face_count": j.face_count,
                "is_watertight": j.is_watertight,
                "generation_time_s": j.generation_time_s,
                "gpu_metrics": j.gpu_metrics,
                "error_message": j.error_message,
                "feedback_rating": j.feedback_rating,
                "created_at": j.created_at.isoformat() if j.created_at else None,
                "completed_at": j.completed_at.isoformat() if j.completed_at else None,
            }
            for j in jobs
        ],
        "total": total,
        "page": page,
        "pages": max(1, (total + limit - 1) // limit),
    }


@router.get("/jobs/{job_id}", dependencies=[Depends(_verify_admin)])
async def get_job_detail(job_id: str, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Job not found")
    return {
        "id": job.id,
        "status": job.status,
        "original_filename": job.original_filename,
        "client_ip": job.client_ip,
        "settings": job.settings,
        "vertex_count": job.vertex_count,
        "face_count": job.face_count,
        "is_watertight": job.is_watertight,
        "generation_time_s": job.generation_time_s,
        "gpu_metrics": job.gpu_metrics,
        "error_message": job.error_message,
        "error_step": job.error_step,
        "feedback_rating": job.feedback_rating,
        "feedback_text": job.feedback_text,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "assigned_at": job.assigned_at.isoformat() if job.assigned_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
    }


@router.post("/jobs/{job_id}/cancel", dependencies=[Depends(_verify_admin)])
async def cancel_job(job_id: str, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Job not found")
    if job.status in (JobStatus.complete, JobStatus.failed, JobStatus.expired):
        raise HTTPException(400, "Job already finished")
    job.status = JobStatus.failed
    job.error_message = "Cancelled by admin"
    job.completed_at = datetime.utcnow()
    await session.commit()
    return {"status": "cancelled"}


@router.post("/jobs/{job_id}/retry", dependencies=[Depends(_verify_admin)])
async def retry_job(job_id: str, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Job not found")
    job.status = JobStatus.pending
    job.error_message = None
    job.error_step = None
    job.assigned_at = None
    job.completed_at = None
    job.progress_pct = 0
    job.current_step = None
    await session.commit()
    return {"status": "retrying"}


@router.delete("/jobs/{job_id}", dependencies=[Depends(_verify_admin)])
async def delete_job(job_id: str, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Job not found")
    await session.delete(job)
    await session.commit()
    return {"deleted": True}


# ─── IP Ban CRUD ───────────────────────────────────────────────

class BanCreate(BaseModel):
    ip: str | None = None
    ip_or_cidr: str | None = None
    reason: str | None = None


@router.get("/bans", dependencies=[Depends(_verify_admin)])
async def list_bans(session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(IPBan))
    bans = result.scalars().all()
    return [{"id": b.id, "ip_or_cidr": b.ip_or_cidr, "reason": b.reason, "created_at": b.created_at.isoformat()} for b in bans]


@router.post("/bans", dependencies=[Depends(_verify_admin)])
async def create_ban(body: BanCreate, session: AsyncSession = Depends(get_session)):
    ip_value = body.ip or body.ip_or_cidr
    if not ip_value:
        raise HTTPException(400, "ip or ip_or_cidr required")
    ban = IPBan(ip_or_cidr=ip_value, reason=body.reason)
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


# ─── Reports (stub) ──────────────────────────────────────────

@router.get("/reports", dependencies=[Depends(_verify_admin)])
async def list_reports(status: str = "pending"):
    return []


@router.post("/reports/{report_id}/dismiss", dependencies=[Depends(_verify_admin)])
async def dismiss_report(report_id: int):
    raise HTTPException(404, "Report not found")


@router.post("/reports/{report_id}/remove", dependencies=[Depends(_verify_admin)])
async def remove_reported_job(report_id: int):
    raise HTTPException(404, "Report not found")


# ─── Settings ─────────────────────────────────────────────────

@router.get("/settings", dependencies=[Depends(_verify_admin)])
async def get_settings():
    return {
        "rate_limit_per_day": settings.rate_limit_per_day,
        "max_pending_jobs": settings.max_pending_jobs,
        "job_timeout_s": settings.job_timeout_s,
        "default_steps": settings.default_steps,
        "default_guidance": settings.default_guidance,
        "default_octree_res": settings.default_octree_res,
        "default_seed": settings.default_seed,
        "default_height_mm": settings.default_height_mm,
    }


@router.patch("/settings", dependencies=[Depends(_verify_admin)])
async def update_settings(body: dict):
    # Runtime settings update — only affects in-memory values for this process
    allowed = {
        "rate_limit_per_day", "max_pending_jobs", "job_timeout_s",
        "default_steps", "default_guidance", "default_octree_res",
        "default_seed", "default_height_mm",
    }
    updated = {}
    for key, value in body.items():
        if key in allowed and hasattr(settings, key):
            setattr(settings, key, value)
            updated[key] = value
    return {"updated": updated}


# ─── Audit log ─────────────────────────────────────────────────

@router.get("/audit", dependencies=[Depends(_verify_admin)])
async def audit_log(
    limit: int = Query(50, ge=1, le=200),
    page: int = Query(1, ge=1),
    action: str | None = None,
    after: str | None = None,
    before: str | None = None,
    session: AsyncSession = Depends(get_session),
):
    stmt = select(AuditLog)
    count_stmt = select(func.count()).select_from(AuditLog)

    if action:
        stmt = stmt.where(AuditLog.action == action)
        count_stmt = count_stmt.where(AuditLog.action == action)
    if after:
        stmt = stmt.where(AuditLog.created_at >= after)
        count_stmt = count_stmt.where(AuditLog.created_at >= after)
    if before:
        stmt = stmt.where(AuditLog.created_at <= before)
        count_stmt = count_stmt.where(AuditLog.created_at <= before)

    total = (await session.execute(count_stmt)).scalar_one()
    offset = (page - 1) * limit
    result = await session.execute(
        stmt.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit)
    )
    logs = result.scalars().all()

    return {
        "logs": [
            {
                "id": l.id,
                "action": l.action,
                "client_ip": l.client_ip,
                "job_id": l.job_id,
                "detail": l.detail,
                "created_at": l.created_at.isoformat(),
            }
            for l in logs
        ],
        "total": total,
        "page": page,
        "pages": max(1, (total + limit - 1) // limit),
    }


# ─── Stats ─────────────────────────────────────────────────────

@router.get("/stats", dependencies=[Depends(_verify_admin)])
async def stats(session: AsyncSession = Depends(get_session)):
    now = datetime.utcnow()

    cutoff_24h = now - timedelta(hours=24)
    result = await session.execute(
        select(func.count()).select_from(Job).where(Job.created_at >= cutoff_24h)
    )
    jobs_24h = result.scalar_one()

    result = await session.execute(
        select(func.count(func.distinct(Job.client_ip)))
        .select_from(Job)
        .where(Job.created_at >= cutoff_24h)
    )
    unique_ips_24h = result.scalar_one()

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
