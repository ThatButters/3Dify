import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlmodel.ext.asyncio.session import AsyncSession as SQLModelAsyncSession

from database import engine
from models.job import Job, JobStatus
from services.worker_bridge import WorkerBridge

router = APIRouter()


def _get_bridge(ws: WebSocket) -> WorkerBridge:
    return ws.app.state.worker_bridge


@router.websocket("/ws/job/{job_id}")
async def job_progress_websocket(ws: WebSocket, job_id: str):
    await ws.accept()
    bridge = _get_bridge(ws)

    # Send current state immediately
    async with SQLModelAsyncSession(engine, expire_on_commit=False) as session:
        result = await session.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()

    if not job:
        await ws.send_json({"type": "error", "message": "Job not found"})
        await ws.close()
        return

    # Send current status snapshot
    await ws.send_json({
        "type": "status",
        "job_id": job.id,
        "status": job.status.value,
        "step": job.current_step,
        "progress_pct": job.progress_pct,
        "message": job.progress_message,
    })

    # If job is already terminal, close
    if job.status in (JobStatus.complete, JobStatus.failed, JobStatus.expired):
        if job.status == JobStatus.complete:
            await ws.send_json({
                "type": "complete",
                "job_id": job.id,
                "vertex_count": job.vertex_count,
                "face_count": job.face_count,
                "is_watertight": job.is_watertight,
                "generation_time_s": job.generation_time_s,
            })
        elif job.status == JobStatus.failed:
            await ws.send_json({
                "type": "failed",
                "job_id": job.id,
                "error": job.error_message,
                "step": job.error_step,
            })
        await ws.close()
        return

    # Subscribe to live updates
    bridge.subscribe(job_id, ws)
    try:
        while True:
            # Keep connection alive — expect client pings
            data = await asyncio.wait_for(ws.receive_text(), timeout=60)
    except (WebSocketDisconnect, asyncio.TimeoutError, Exception):
        pass
    finally:
        bridge.unsubscribe(job_id, ws)
