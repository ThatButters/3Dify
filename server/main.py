import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import create_db
from services.worker_bridge import WorkerBridge
from services import queue as queue_service
from sqlmodel.ext.asyncio.session import AsyncSession as SQLModelAsyncSession
from database import engine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s  %(message)s",
)
logger = logging.getLogger("server")


async def _cleanup_loop():
    """Periodically expire stale jobs."""
    while True:
        try:
            await asyncio.sleep(settings.cleanup_interval_s)
            async with SQLModelAsyncSession(engine, expire_on_commit=False) as session:
                expired = await queue_service.expire_stale_jobs(session)
                if expired:
                    logger.info("Expired %d stale jobs: %s", len(expired), expired)
        except asyncio.CancelledError:
            break
        except Exception:
            logger.exception("Error in cleanup loop")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure directories exist
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    Path(settings.output_dir).mkdir(parents=True, exist_ok=True)

    # Create tables (dev convenience — use alembic in production)
    await create_db()

    # Reset orphaned jobs (assigned/processing at shutdown) back to pending
    async with SQLModelAsyncSession(engine, expire_on_commit=False) as session:
        from sqlalchemy import select
        from models.job import Job, JobStatus
        result = await session.execute(
            select(Job).where(Job.status.in_([JobStatus.assigned, JobStatus.processing]))
        )
        orphaned = result.scalars().all()
        for job in orphaned:
            job.status = JobStatus.pending
            job.assigned_at = None
            job.current_step = None
            job.progress_pct = 0
            job.progress_message = None
        if orphaned:
            await session.commit()
            logger.info("Re-queued %d orphaned jobs on startup", len(orphaned))

    # Singletons
    app.state.worker_bridge = WorkerBridge()

    # Background tasks
    cleanup_task = asyncio.create_task(_cleanup_loop())
    logger.info("Server started")

    yield

    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass
    logger.info("Server stopped")


app = FastAPI(title="PictureToPrintable", version="0.1.0", lifespan=lifespan)

# CORS — only allow credentials when origins are explicitly configured
_has_wildcard = "*" in settings.cors_origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=not _has_wildcard,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
from routes.worker_ws import router as worker_ws_router
from routes.client_ws import router as client_ws_router
from routes.jobs import router as jobs_router
from routes.admin import router as admin_router
from routes.feedback import router as feedback_router
from routes.gallery import router as gallery_router

app.include_router(worker_ws_router)
app.include_router(client_ws_router)
app.include_router(jobs_router)
app.include_router(admin_router)
app.include_router(feedback_router)
app.include_router(gallery_router)


@app.get("/health")
async def health():
    bridge = app.state.worker_bridge
    return {
        "status": "ok",
        "worker_connected": bridge.worker_connected,
        "paused": bridge.paused,
    }
