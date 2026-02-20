import asyncio
import base64
import logging
from datetime import datetime, timezone

from fastapi import WebSocket
from sqlmodel.ext.asyncio.session import AsyncSession as SQLModelAsyncSession

from config import settings
from database import engine
from models.audit_log import AuditLog
from services import queue, storage

logger = logging.getLogger("worker_bridge")


class WorkerBridge:
    """Manages the worker WebSocket connection, job dispatch, and client fan-out."""

    def __init__(self):
        self.worker_ws: WebSocket | None = None
        self.worker_info: dict = {}
        self.gpu_status: dict = {}
        self.paused: bool = False

        # Client progress subscriptions: job_id -> set of WebSocket connections
        self._subscribers: dict[str, set[WebSocket]] = {}
        self._dispatch_task: asyncio.Task | None = None

    # ─── Client subscription ───────────────────────────────────────

    def subscribe(self, job_id: str, ws: WebSocket) -> None:
        self._subscribers.setdefault(job_id, set()).add(ws)

    def unsubscribe(self, job_id: str, ws: WebSocket) -> None:
        subs = self._subscribers.get(job_id)
        if subs:
            subs.discard(ws)
            if not subs:
                del self._subscribers[job_id]

    async def _fan_out(self, job_id: str, message: dict) -> None:
        """Send message to all client WebSockets subscribed to this job."""
        subs = self._subscribers.get(job_id, set()).copy()
        for ws in subs:
            try:
                await ws.send_json(message)
            except Exception:
                self.unsubscribe(job_id, ws)

    # ─── Worker connection ─────────────────────────────────────────

    @property
    def worker_connected(self) -> bool:
        return self.worker_ws is not None

    async def handle_worker(self, ws: WebSocket) -> None:
        """Main loop for the worker WebSocket — call from the route handler."""
        if self.worker_ws is not None:
            await ws.close(code=4000, reason="Another worker already connected")
            return

        self.worker_ws = ws
        await ws.send_json({"type": "welcome", "message": "Connected to server"})
        logger.info("Worker connected")

        # Start dispatch loop
        self._dispatch_task = asyncio.create_task(self._dispatch_loop())

        try:
            async for raw in ws.iter_json():
                await self._handle_worker_message(raw)
        except Exception as e:
            logger.warning("Worker disconnected: %s", e)
        finally:
            self.worker_ws = None
            self.worker_info = {}
            self.gpu_status = {}
            if self._dispatch_task:
                self._dispatch_task.cancel()
                self._dispatch_task = None
            logger.info("Worker disconnected, cleaned up")

    async def _handle_worker_message(self, msg: dict) -> None:
        msg_type = msg.get("type")

        if msg_type == "worker_hello":
            self.worker_info = {
                "gpu_name": msg.get("gpu_name"),
                "vram_total_gb": msg.get("vram_total_gb"),
                "worker_version": msg.get("worker_version"),
            }
            logger.info("Worker hello: %s", self.worker_info)

        elif msg_type == "gpu_status":
            self.gpu_status = {
                "vram_free_gb": msg.get("vram_free_gb"),
                "vram_used_gb": msg.get("vram_used_gb"),
                "vram_total_gb": msg.get("vram_total_gb"),
                "utilization_pct": msg.get("utilization_pct"),
                "temp_c": msg.get("temp_c"),
                "available": msg.get("available"),
                "model_loaded": msg.get("model_loaded"),
            }

        elif msg_type == "job_progress":
            job_id = msg.get("job_id")
            if job_id:
                # Update DB progress
                await self._update_progress(
                    job_id,
                    step=msg.get("step"),
                    pct=msg.get("progress_pct", 0),
                    message=msg.get("message"),
                )
                # Fan out to clients
                await self._fan_out(job_id, {
                    "type": "progress",
                    "job_id": job_id,
                    "step": msg.get("step"),
                    "progress_pct": msg.get("progress_pct", 0),
                    "message": msg.get("message"),
                })

        elif msg_type == "job_complete":
            await self._handle_job_complete(msg)

        elif msg_type == "job_failed":
            await self._handle_job_failed(msg)

        elif msg_type == "pong":
            pass  # Heartbeat response

        elif msg_type == "worker_bye":
            logger.info("Worker sent bye: %s", msg.get("reason"))

    # ─── Job lifecycle ─────────────────────────────────────────────

    async def _dispatch_loop(self) -> None:
        """Periodically check for pending jobs and dispatch to the worker."""
        while True:
            try:
                await asyncio.sleep(2)
                if not self.worker_ws or self.paused:
                    continue
                if self.gpu_status and not self.gpu_status.get("available", True):
                    continue

                async with SQLModelAsyncSession(engine, expire_on_commit=False) as session:
                    job = await queue.get_next_pending(session)
                    if not job:
                        continue

                    # Read image file and send to worker
                    upload_file = storage.get_upload_path(job.upload_path)
                    if not upload_file.exists():
                        await queue.mark_failed(
                            session, job.id, error="Upload file missing", step="queued"
                        )
                        continue

                    image_data = upload_file.read_bytes()
                    image_b64 = base64.b64encode(image_data).decode()

                    await self.worker_ws.send_json({
                        "type": "job_assign",
                        "job_id": job.id,
                        "image_filename": job.original_filename,
                        "image_base64": image_b64,
                        "settings": job.settings,
                    })
                    logger.info("Dispatched job %s to worker", job.id)

            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("Error in dispatch loop")
                await asyncio.sleep(5)

    async def _update_progress(
        self, job_id: str, step: str | None, pct: int, message: str | None
    ) -> None:
        try:
            async with SQLModelAsyncSession(engine, expire_on_commit=False) as session:
                from sqlalchemy import select
                from models.job import Job, JobStatus

                result = await session.execute(select(Job).where(Job.id == job_id))
                job = result.scalar_one_or_none()
                if job:
                    if job.status == JobStatus.assigned:
                        job.status = JobStatus.processing
                    job.current_step = step
                    job.progress_pct = pct
                    job.progress_message = message
                    await session.commit()
        except Exception:
            logger.exception("Failed to update progress for %s", job_id)

    async def _handle_job_complete(self, msg: dict) -> None:
        job_id = msg.get("job_id")
        if not job_id:
            return

        try:
            # Save STL file
            stl_b64 = msg.get("stl_base64")
            stl_rel = None
            if stl_b64:
                stl_data = base64.b64decode(stl_b64)
                stl_rel = f"{job_id}/model.stl"
                storage.save_output(stl_data, stl_rel)

            # Save GLB file (optional)
            glb_b64 = msg.get("glb_base64")
            glb_rel = None
            if glb_b64:
                glb_data = base64.b64decode(glb_b64)
                glb_rel = f"{job_id}/model.glb"
                storage.save_output(glb_data, glb_rel)

            # Update DB
            async with SQLModelAsyncSession(engine, expire_on_commit=False) as session:
                job = await queue.mark_complete(
                    session,
                    job_id,
                    stl_path=stl_rel,
                    glb_path=glb_rel,
                    vertex_count=msg.get("vertex_count", 0),
                    face_count=msg.get("face_count", 0),
                    is_watertight=msg.get("is_watertight", False),
                    generation_time_s=msg.get("generation_time_s", 0),
                    gpu_metrics=msg.get("gpu_metrics"),
                )

                # Audit log
                session.add(AuditLog(
                    action="job_complete", job_id=job_id,
                    detail=f"vertices={msg.get('vertex_count')}"
                ))
                await session.commit()

            # Notify clients
            await self._fan_out(job_id, {
                "type": "complete",
                "job_id": job_id,
                "vertex_count": msg.get("vertex_count"),
                "face_count": msg.get("face_count"),
                "is_watertight": msg.get("is_watertight"),
                "generation_time_s": msg.get("generation_time_s"),
            })
            logger.info("Job %s complete (%d vertices)", job_id, msg.get("vertex_count", 0))

        except Exception:
            logger.exception("Error handling job_complete for %s", job_id)

    async def _handle_job_failed(self, msg: dict) -> None:
        job_id = msg.get("job_id")
        if not job_id:
            return

        error = msg.get("error", "Unknown error")
        step = msg.get("step")

        try:
            async with SQLModelAsyncSession(engine, expire_on_commit=False) as session:
                await queue.mark_failed(session, job_id, error=error, step=step)
                session.add(AuditLog(
                    action="job_failed", job_id=job_id, detail=error
                ))
                await session.commit()

            await self._fan_out(job_id, {
                "type": "failed",
                "job_id": job_id,
                "error": error,
                "step": step,
            })
            logger.warning("Job %s failed at %s: %s", job_id, step, error)

        except Exception:
            logger.exception("Error handling job_failed for %s", job_id)

    # ─── Admin commands ────────────────────────────────────────────

    async def send_command(self, action: str, job_id: str | None = None) -> bool:
        """Send a command to the worker. Returns True if sent."""
        if not self.worker_ws:
            return False
        msg = {"type": "command", "action": action}
        if job_id:
            msg["job_id"] = job_id
        await self.worker_ws.send_json(msg)
        return True

    async def send_ping(self) -> bool:
        if not self.worker_ws:
            return False
        await self.worker_ws.send_json({"type": "ping"})
        return True
