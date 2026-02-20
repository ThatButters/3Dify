"""Worker service: connects to VPS via WebSocket, processes img2stl jobs.

Usage:
    python worker.py                     # connect to mock server at localhost:8765
    python worker.py --url wss://...     # connect to production VPS
    python worker.py --preload           # pre-load the AI model on startup
"""

import asyncio
import base64
import json
import logging
import logging.handlers
import os
import shutil
import signal
import sys
import time
from pathlib import Path

import websockets

import config
import gpu_monitor
import gpu_sampler as gpu_sampler_mod

logger = logging.getLogger('worker')


def setup_logging():
    """Configure logging to stdout + rotating file."""
    os.makedirs(config.LOG_DIR, exist_ok=True)

    fmt = logging.Formatter(
        '%(asctime)s %(levelname)-7s %(name)s  %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S',
    )

    # Stdout handler
    sh = logging.StreamHandler(sys.stdout)
    sh.setFormatter(fmt)

    # Rotating file handler (5MB × 3 files)
    fh = logging.handlers.RotatingFileHandler(
        os.path.join(config.LOG_DIR, 'worker.log'),
        maxBytes=5_000_000,
        backupCount=3,
    )
    fh.setFormatter(fmt)

    root = logging.getLogger()
    root.setLevel(logging.INFO)
    root.addHandler(sh)
    root.addHandler(fh)


class Worker:
    def __init__(self, url: str = None, preload: bool = False):
        self.url = url or config.VPS_WS_URL
        self.preload = preload

        self.ws = None
        self.paused = False
        self.current_job_id = None
        self.should_stop = False
        self.reconnect_delay = config.RECONNECT_BASE_S
        self.force_next = False  # skip GPU check for next job
        self.last_job_finished = None  # timestamp for idle unload

        os.makedirs(config.TEMP_DIR, exist_ok=True)

    async def run(self):
        """Main entry: connect, process, reconnect forever."""
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(sig, self._handle_signal)

        if self.preload:
            logger.info("Pre-loading pipeline...")
            import pipeline
            await loop.run_in_executor(None, pipeline.load_model)

        while not self.should_stop:
            try:
                await self._connect_and_serve()
            except websockets.ConnectionClosed as e:
                if self.should_stop:
                    break
                logger.warning(f"Connection closed: {e}")
            except (OSError, ConnectionRefusedError) as e:
                if self.should_stop:
                    break
                logger.warning(f"Connection failed: {e}")
            except asyncio.CancelledError:
                break

            if self.should_stop:
                break

            logger.info(f"Reconnecting in {self.reconnect_delay}s...")
            await asyncio.sleep(self.reconnect_delay)
            self.reconnect_delay = min(
                self.reconnect_delay * 2, config.RECONNECT_MAX_S)

        logger.info("Worker stopped")

    def _handle_signal(self):
        """Signal handler — request graceful shutdown."""
        logger.info("Shutdown signal received")
        self.should_stop = True

    async def _connect_and_serve(self):
        """Open WebSocket, send hello, listen for messages."""
        headers = {"Authorization": f"Bearer {config.AUTH_TOKEN}"}

        async with websockets.connect(self.url,
                                      additional_headers=headers,
                                      max_size=config.WS_MAX_SIZE) as ws:
            self.ws = ws
            self.reconnect_delay = config.RECONNECT_BASE_S
            logger.info(f"Connected to {self.url}")

            # Send hello
            status = gpu_monitor.get_gpu_status()
            await self._send({
                "type": "worker_hello",
                "gpu_name": status.get('gpu_name', 'Unknown'),
                "vram_total_gb": status.get('vram_total_gb', 0),
                "worker_version": config.WORKER_VERSION,
            })

            # Start heartbeat and idle unloader in background
            heartbeat = asyncio.create_task(self._heartbeat_loop())
            idle_unloader = asyncio.create_task(self._idle_unload_loop())

            try:
                async for raw in ws:
                    msg = json.loads(raw)
                    await self._handle_message(msg)

                    if self.should_stop and not self.current_job_id:
                        break
            finally:
                heartbeat.cancel()
                idle_unloader.cancel()
                for task in (heartbeat, idle_unloader):
                    try:
                        await task
                    except asyncio.CancelledError:
                        pass

            # Graceful bye
            if self.should_stop:
                await self._send({"type": "worker_bye", "reason": "shutdown"})
            self.ws = None

    async def _handle_message(self, msg: dict):
        """Route an incoming message."""
        t = msg.get("type")

        if t == "welcome":
            logger.info(f"Server: {msg.get('message', 'connected')}")

        elif t == "ping":
            await self._send({"type": "pong"})

        elif t == "job_assign":
            await self._handle_job(msg)

        elif t == "command":
            await self._handle_command(msg)

        else:
            logger.warning(f"Unknown message type: {t}")

    async def _handle_command(self, msg: dict):
        action = msg.get("action")
        if action == "pause":
            self.paused = True
            logger.info("Worker PAUSED — will decline new jobs")
        elif action == "resume":
            self.paused = False
            logger.info("Worker RESUMED — accepting jobs")
        elif action == "force_process":
            self.force_next = True
            logger.info("Force mode — next job skips GPU check")
        elif action == "cancel":
            jid = msg.get("job_id")
            logger.info(f"Cancel requested for {jid} (not implemented yet)")
        else:
            logger.warning(f"Unknown command: {action}")

    # ── Job Processing ────────────────────────────────────────────────────

    async def _handle_job(self, msg: dict):
        job_id = msg["job_id"]

        if self.paused:
            logger.info(f"Job {job_id} declined — worker is paused")
            await self._send({
                "type": "job_failed", "job_id": job_id,
                "error": "Worker is paused", "step": "queued",
            })
            return

        if self.current_job_id:
            logger.info(f"Job {job_id} declined — already processing")
            await self._send({
                "type": "job_failed", "job_id": job_id,
                "error": "Worker is busy", "step": "queued",
            })
            return

        self.current_job_id = job_id
        logger.info(f"Job {job_id} accepted")

        try:
            await self._process_job(msg)
        except Exception as e:
            logger.exception(f"Job {job_id} failed")
            await self._send({
                "type": "job_failed", "job_id": job_id,
                "error": str(e), "step": "unknown",
            })
        finally:
            self.current_job_id = None
            self.last_job_finished = time.time()

    async def _process_job(self, msg: dict):
        import pipeline  # deferred import to avoid loading torch at startup

        job_id = msg["job_id"]
        filename = msg.get("image_filename", "input.jpg")
        settings = msg.get("settings", {})
        loop = asyncio.get_running_loop()

        # ── GPU check ──
        if self.force_next:
            self.force_next = False
            logger.info("Skipping GPU check (force mode)")
        else:
            await self._send_progress(
                job_id, "waiting_gpu", 0, "Checking GPU availability...")

            threshold = pipeline.get_vram_threshold()

            def _wait():
                gpu_monitor.wait_for_gpu(
                    min_vram_gb=threshold,
                    max_util_pct=config.MAX_GPU_UTIL_PCT,
                    poll_interval=config.GPU_POLL_INTERVAL_S,
                    cooldown=config.GPU_COOLDOWN_S,
                )

            await loop.run_in_executor(None, _wait)

        # ── Save input image ──
        image_data = base64.b64decode(msg["image_base64"])
        image_path = os.path.join(config.TEMP_DIR, filename)
        with open(image_path, 'wb') as f:
            f.write(image_data)
        logger.info(f"Saved input image: {image_path} ({len(image_data)} bytes)")

        output_dir = os.path.join(config.TEMP_DIR, job_id)

        # ── Start GPU sampler ──
        sampler = gpu_sampler_mod.GPUSampler(interval=1.0)
        sampler.start()

        # ── Progress callback (sync → async bridge) ──
        def progress_cb(step, pct, message):
            asyncio.run_coroutine_threadsafe(
                self._send_progress(job_id, step, pct, message),
                loop,
            )

        # ── Run pipeline in executor (blocking) ──
        try:
            result = await loop.run_in_executor(
                None,
                pipeline.run_pipeline,
                image_path, output_dir, progress_cb, settings,
            )
        finally:
            gpu_metrics = sampler.stop()

        # ── Read output files ──
        try:
            stl_path = result['stl_path']
            glb_path = result['glb_path']

            with open(stl_path, 'rb') as f:
                stl_b64 = base64.b64encode(f.read()).decode('ascii')

            glb_b64 = None
            glb_filename = None
            if os.path.exists(glb_path):
                with open(glb_path, 'rb') as f:
                    glb_b64 = base64.b64encode(f.read()).decode('ascii')
                glb_filename = Path(glb_path).name

            # ── Send completion ──
            await self._send({
                "type": "job_complete",
                "job_id": job_id,
                "stl_filename": Path(stl_path).name,
                "stl_base64": stl_b64,
                "glb_filename": glb_filename,
                "glb_base64": glb_b64,
                "vertex_count": result['vertex_count'],
                "face_count": result['face_count'],
                "is_watertight": result['is_watertight'],
                "generation_time_s": result['generation_time_s'],
                "gpu_metrics": gpu_metrics,
            })

            stl_mb = os.path.getsize(stl_path) / 1e6
            logger.info(
                f"Job {job_id} complete: "
                f"{result['vertex_count']:,}v, "
                f"watertight={result['is_watertight']}, "
                f"{result['generation_time_s']:.1f}s, "
                f"STL={stl_mb:.1f}MB"
            )
        finally:
            # ── Cleanup — always runs, even on read/send errors ──
            try:
                os.remove(image_path)
            except OSError:
                pass
            shutil.rmtree(output_dir, ignore_errors=True)

    # ── Messaging ─────────────────────────────────────────────────────────

    async def _send_progress(self, job_id, step, pct, message):
        await self._send({
            "type": "job_progress",
            "job_id": job_id,
            "step": step,
            "progress_pct": pct,
            "message": message,
        })

    async def _send(self, data: dict):
        if self.ws:
            try:
                await self.ws.send(json.dumps(data))
            except websockets.ConnectionClosed:
                logger.warning("Send failed — connection closed")
            except Exception as e:
                logger.warning(f"Send failed: {e}")

    async def _idle_unload_loop(self):
        """Unload model from VRAM after idle timeout to free memory."""
        while True:
            await asyncio.sleep(60)  # check every minute
            if (self.last_job_finished
                    and not self.current_job_id
                    and time.time() - self.last_job_finished > config.MODEL_IDLE_TIMEOUT_S):
                import pipeline
                if pipeline.is_model_loaded():
                    logger.info(f"Idle for {config.MODEL_IDLE_TIMEOUT_S}s — unloading model from VRAM")
                    loop = asyncio.get_running_loop()
                    await loop.run_in_executor(None, pipeline.unload_model)
                    self.last_job_finished = None  # reset so we don't keep trying

    async def _heartbeat_loop(self):
        """Send GPU status every HEARTBEAT_INTERVAL_S seconds."""
        while True:
            await asyncio.sleep(config.HEARTBEAT_INTERVAL_S)
            status = gpu_monitor.get_gpu_status()
            import pipeline
            payload = {
                "type": "gpu_status",
                "vram_free_gb": status.get('vram_free_gb', 0),
                "vram_used_gb": status.get('vram_used_gb', 0),
                "utilization_pct": status.get('utilization_pct', 0),
                "temp_c": status.get('temp_c', 0),
                "available": not self.paused and not self.current_job_id,
                "model_loaded": pipeline.is_model_loaded(),
            }
            await self._send(payload)


# ── Entry point ───────────────────────────────────────────────────────────

def main():
    import argparse
    parser = argparse.ArgumentParser(description="img2stl worker service")
    parser.add_argument("--url", default=None,
                        help=f"WebSocket URL (default: {config.VPS_WS_URL})")
    parser.add_argument("--preload", action="store_true",
                        help="Pre-load the AI model on startup")
    args = parser.parse_args()

    setup_logging()

    if not config.AUTH_TOKEN:
        logger.error("WORKER_AUTH_TOKEN env var is not set — cannot connect")
        sys.exit(1)

    logger.info(f"img2stl worker v{config.WORKER_VERSION}")
    logger.info(f"Connecting to {args.url or config.VPS_WS_URL}")

    worker = Worker(url=args.url, preload=args.preload)

    try:
        asyncio.run(worker.run())
    except KeyboardInterrupt:
        logger.info("Interrupted")


if __name__ == "__main__":
    main()
