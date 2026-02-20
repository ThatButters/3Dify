"""Mock VPS server for testing the worker locally.

Simulates the server side of the WebSocket protocol:
- Accepts worker connections with token auth
- Sends test jobs (image → worker → STL back)
- Displays progress updates in real-time
- Interactive commands via stdin

Usage:
    python mock_server.py --test-image /path/to/beavis.jpg
    python mock_server.py   # no auto-job, interactive only

Interactive commands (type while running):
    job <path>   — send a job with the specified image
    pause        — send pause command
    resume       — send resume command
    force        — send force_process command
    status       — request GPU status
    quit         — shut down
"""

import asyncio
import argparse
import base64
import json
import logging
import os
import sys
import time
import uuid
from pathlib import Path

import websockets

import config

logging.basicConfig(
    format='%(asctime)s %(levelname)-7s %(message)s',
    datefmt='%H:%M:%S',
    level=logging.INFO,
)
logger = logging.getLogger('mock_server')

# Global state
connected_worker = None
worker_info = {}


def fmt_size(nbytes: int) -> str:
    """Format byte count as human-readable."""
    if nbytes > 1_000_000:
        return f"{nbytes / 1_000_000:.1f}MB"
    if nbytes > 1_000:
        return f"{nbytes / 1_000:.1f}KB"
    return f"{nbytes}B"


def make_job_message(image_path: str, settings: dict = None) -> dict:
    """Create a job_assign message from an image file."""
    with open(image_path, 'rb') as f:
        image_data = f.read()

    return {
        "type": "job_assign",
        "job_id": str(uuid.uuid4()),
        "image_base64": base64.b64encode(image_data).decode('ascii'),
        "image_filename": Path(image_path).name,
        "settings": settings or {
            "steps": config.DEFAULT_STEPS,
            "guidance": config.DEFAULT_GUIDANCE,
            "octree_res": config.DEFAULT_OCTREE_RES,
            "seed": config.DEFAULT_SEED,
        },
    }


async def handle_worker(websocket):
    """Handle a single worker connection."""
    global connected_worker, worker_info

    # Check auth
    auth = websocket.request.headers.get("Authorization", "")
    expected = f"Bearer {config.AUTH_TOKEN}"
    if auth != expected:
        logger.warning(f"Auth failed from {websocket.remote_address}")
        await websocket.close(4001, "Unauthorized")
        return

    connected_worker = websocket
    logger.info("Worker connected")

    # Send welcome
    await websocket.send(json.dumps({
        "type": "welcome",
        "message": "Mock server — worker connected",
    }))

    try:
        async for raw in websocket:
            msg = json.loads(raw)
            await handle_message(websocket, msg)
    except websockets.ConnectionClosed:
        logger.info("Worker disconnected")
    finally:
        connected_worker = None
        worker_info = {}


async def handle_message(ws, msg: dict):
    """Process a message from the worker."""
    t = msg.get("type")

    if t == "worker_hello":
        worker_info.update(msg)
        logger.info(
            f"  HELLO: {msg.get('gpu_name')} "
            f"({msg.get('vram_total_gb', 0):.1f}GB), "
            f"v{msg.get('worker_version')}"
        )

    elif t == "gpu_status":
        logger.info(
            f"  GPU: {msg.get('vram_free_gb', 0):.1f}GB free, "
            f"{msg.get('utilization_pct', 0)}% util, "
            f"{msg.get('temp_c', 0)}C, "
            f"available={msg.get('available')}, "
            f"model_loaded={msg.get('model_loaded')}"
        )

    elif t == "job_progress":
        bar_len = 30
        pct = msg.get('progress_pct', 0)
        filled = int(bar_len * pct / 100)
        bar = '#' * filled + '-' * (bar_len - filled)
        logger.info(
            f"  PROGRESS [{bar}] {pct}% — "
            f"{msg.get('step')}: {msg.get('message')}"
        )

    elif t == "job_complete":
        job_id = msg['job_id']
        logger.info(f"  JOB COMPLETE: {job_id}")
        logger.info(
            f"    Vertices: {msg.get('vertex_count', 0):,}")
        logger.info(
            f"    Faces: {msg.get('face_count', 0):,}")
        logger.info(
            f"    Watertight: {msg.get('is_watertight')}")
        logger.info(
            f"    Time: {msg.get('generation_time_s', 0):.1f}s")

        metrics = msg.get('gpu_metrics', {})
        if metrics:
            logger.info(
                f"    GPU: {metrics.get('peak_vram_mb', 0)}MB peak, "
                f"{metrics.get('avg_gpu_util_pct', 0)}% avg util, "
                f"{metrics.get('gpu_energy_j', 0)}J energy"
            )

        # Save STL
        stl_b64 = msg.get('stl_base64')
        stl_name = msg.get('stl_filename', 'output.stl')
        if stl_b64:
            stl_data = base64.b64decode(stl_b64)
            out_path = Path('.') / stl_name
            with open(out_path, 'wb') as f:
                f.write(stl_data)
            logger.info(f"    STL saved: {out_path} ({fmt_size(len(stl_data))})")

        # Save GLB
        glb_b64 = msg.get('glb_base64')
        glb_name = msg.get('glb_filename')
        if glb_b64 and glb_name:
            glb_data = base64.b64decode(glb_b64)
            out_path = Path('.') / glb_name
            with open(out_path, 'wb') as f:
                f.write(glb_data)
            logger.info(f"    GLB saved: {out_path} ({fmt_size(len(glb_data))})")

    elif t == "job_failed":
        logger.error(
            f"  JOB FAILED: {msg.get('job_id')} "
            f"at {msg.get('step')}: {msg.get('error')}"
        )

    elif t == "worker_bye":
        logger.info(f"  BYE: {msg.get('reason')}")

    elif t == "pong":
        pass  # heartbeat response, ignore

    else:
        logger.info(f"  {t}: {json.dumps(msg, indent=2)}")


async def stdin_loop():
    """Read interactive commands from stdin."""
    loop = asyncio.get_running_loop()

    print("\nCommands: job <path>, pause, resume, force, status, quit")
    print("Waiting for input...\n")

    while True:
        line = await loop.run_in_executor(None, sys.stdin.readline)
        if not line:
            break
        line = line.strip()
        if not line:
            continue

        parts = line.split(None, 1)
        cmd = parts[0].lower()

        if cmd == "quit":
            logger.info("Shutting down...")
            break

        if not connected_worker:
            print("  No worker connected")
            continue

        if cmd == "job" and len(parts) > 1:
            path = parts[1]
            if not os.path.exists(path):
                print(f"  File not found: {path}")
                continue
            msg = make_job_message(path)
            await connected_worker.send(json.dumps(msg))
            logger.info(f"Sent job: {msg['job_id']} ({Path(path).name})")

        elif cmd == "pause":
            await connected_worker.send(json.dumps({
                "type": "command", "action": "pause"}))
            logger.info("Sent: pause")

        elif cmd == "resume":
            await connected_worker.send(json.dumps({
                "type": "command", "action": "resume"}))
            logger.info("Sent: resume")

        elif cmd == "force":
            await connected_worker.send(json.dumps({
                "type": "command", "action": "force_process"}))
            logger.info("Sent: force_process")

        elif cmd == "status":
            await connected_worker.send(json.dumps({"type": "ping"}))
            logger.info("Sent: ping")

        else:
            print(f"  Unknown command: {cmd}")
            print("  Commands: job <path>, pause, resume, force, status, quit")


async def auto_job(test_image: str, delay: float = 5.0):
    """Wait for worker to connect, then send a test job after a delay."""
    # Wait for connection
    while connected_worker is None:
        await asyncio.sleep(0.5)

    logger.info(f"Sending test job in {delay:.0f}s...")
    await asyncio.sleep(delay)

    if connected_worker:
        msg = make_job_message(test_image)
        await connected_worker.send(json.dumps(msg))
        logger.info(f"Sent test job: {msg['job_id']} ({Path(test_image).name})")


async def wait_forever():
    """Block until cancelled (used in non-interactive mode)."""
    try:
        while True:
            await asyncio.sleep(3600)
    except asyncio.CancelledError:
        pass


async def main(args):
    host = "localhost"
    port = 8765

    logger.info(f"Mock server starting on ws://{host}:{port}")
    if args.test_image:
        logger.info(f"Will auto-send: {args.test_image}")

    server = await websockets.serve(
        handle_worker, host, port, max_size=config.WS_MAX_SIZE)

    # Fire-and-forget the auto_job
    if args.test_image:
        asyncio.create_task(auto_job(args.test_image))

    # Main loop: stdin commands or just serve forever
    if args.no_interactive:
        await server.serve_forever()
    else:
        await stdin_loop()
        server.close()
        await server.wait_closed()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Mock VPS for worker testing")
    parser.add_argument("--test-image", default=None,
                        help="Auto-send this image as a job on connect")
    parser.add_argument("--no-interactive", action="store_true",
                        help="Disable stdin commands (for background usage)")
    args = parser.parse_args()

    if args.test_image and not os.path.exists(args.test_image):
        print(f"Error: test image not found: {args.test_image}")
        sys.exit(1)

    try:
        asyncio.run(main(args))
    except KeyboardInterrupt:
        logger.info("Interrupted")
