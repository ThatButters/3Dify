from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_session
from models.audit_log import AuditLog
from models.job import Job, JobStatus
from services import image_validator, queue, rate_limiter, storage

router = APIRouter(prefix="/api")


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/upload")
async def upload_image(
    request: Request,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
):
    ip = _client_ip(request)

    # Check ban
    if await rate_limiter.is_banned(session, ip):
        raise HTTPException(403, "IP banned")

    # Check rate limit
    allowed, remaining = await rate_limiter.check_rate_limit(session, ip)
    if not allowed:
        raise HTTPException(429, f"Rate limit exceeded. Try again in 24 hours.")

    # Check queue capacity
    pending = await queue.pending_count(session)
    if pending >= settings.max_pending_jobs:
        raise HTTPException(503, "Queue is full. Please try again later.")

    # Read file data
    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty file")

    # Validate image
    try:
        cleaned, sha256, ext = image_validator.validate_and_process(
            data, file.filename or "upload"
        )
    except image_validator.ImageValidationError as e:
        raise HTTPException(400, str(e))

    # Create job record first to get ID
    job = Job(
        original_filename=file.filename or "upload",
        upload_path="",  # filled below
        image_hash=sha256,
        client_ip=ip,
        user_agent=request.headers.get("user-agent"),
        settings={
            "steps": settings.default_steps,
            "guidance": settings.default_guidance,
            "octree_res": settings.default_octree_res,
            "seed": settings.default_seed,
            "height_mm": settings.default_height_mm,
        },
    )
    job = await queue.enqueue(session, job)

    # Save file with job ID in path
    upload_rel = f"{job.id}/input.{ext}"
    storage.save_upload(cleaned, upload_rel)
    job.upload_path = upload_rel

    # Generate thumbnail
    thumb_rel = f"{job.id}/thumb.jpg"
    thumb_path = storage.get_upload_path(thumb_rel)
    try:
        image_validator.make_thumbnail(cleaned, thumb_path)
        job.thumbnail_path = thumb_rel
    except Exception:
        pass  # Non-critical

    await session.commit()
    await session.refresh(job)

    # Audit log
    session.add(AuditLog(action="upload", client_ip=ip, job_id=job.id))
    await session.commit()
    rate_limiter.invalidate_cache(ip)

    return {
        "job_id": job.id,
        "status": job.status.value,
        "queue_position": pending + 1,
        "remaining_uploads": remaining - 1,
    }


@router.get("/job/{job_id}")
async def get_job(job_id: str, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Job not found")

    resp = {
        "job_id": job.id,
        "status": job.status.value,
        "original_filename": job.original_filename,
        "settings": job.settings,
        "current_step": job.current_step,
        "progress_pct": job.progress_pct,
        "progress_message": job.progress_message,
        "created_at": job.created_at.isoformat(),
    }

    # Add queue position for pending jobs
    if job.status == JobStatus.pending:
        from sqlalchemy import func
        pos_result = await session.execute(
            select(func.count())
            .select_from(Job)
            .where(Job.status == JobStatus.pending, Job.created_at < job.created_at)
        )
        resp["queue_position"] = pos_result.scalar_one() + 1  # 1-indexed

    if job.status == JobStatus.complete:
        resp.update({
            "vertex_count": job.vertex_count,
            "face_count": job.face_count,
            "is_watertight": job.is_watertight,
            "generation_time_s": job.generation_time_s,
            "gpu_metrics": job.gpu_metrics,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
            "stl_url": f"/api/job/{job.id}/stl",
            "glb_url": f"/api/job/{job.id}/glb" if job.glb_path else None,
        })
    elif job.status == JobStatus.failed:
        resp.update({
            "error": job.error_message,
            "error_step": job.error_step,
        })

    return resp


@router.get("/job/{job_id}/thumbnail")
async def get_thumbnail(job_id: str, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Job not found")
    if not job.thumbnail_path:
        raise HTTPException(404, "Thumbnail not available")

    path = storage.get_upload_path(job.thumbnail_path)
    if not path.exists():
        raise HTTPException(404, "Thumbnail file missing")

    return FileResponse(path, media_type="image/jpeg")


@router.get("/job/{job_id}/stl")
async def download_stl(job_id: str, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Job not found")
    if job.status != JobStatus.complete or not job.stl_path:
        raise HTTPException(404, "STL not available")

    path = storage.get_output_path(job.stl_path)
    if not path.exists():
        raise HTTPException(404, "STL file missing")

    return FileResponse(
        path,
        media_type="application/sla",
        filename=f"{job.original_filename.rsplit('.', 1)[0]}.stl",
    )


@router.get("/job/{job_id}/glb")
async def download_glb(job_id: str, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Job not found")
    if job.status != JobStatus.complete or not job.glb_path:
        raise HTTPException(404, "GLB not available")

    path = storage.get_output_path(job.glb_path)
    if not path.exists():
        raise HTTPException(404, "GLB file missing")

    return FileResponse(
        path,
        media_type="model/gltf-binary",
        filename=f"{job.original_filename.rsplit('.', 1)[0]}.glb",
    )


@router.get("/queue")
async def queue_status(session: AsyncSession = Depends(get_session)):
    summary = await queue.get_queue_summary(session)
    return {"queue": summary}
