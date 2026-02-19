import hmac
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from config import settings
from services.worker_bridge import WorkerBridge

logger = logging.getLogger("worker_ws")
router = APIRouter()


def _get_bridge(ws: WebSocket) -> WorkerBridge:
    return ws.app.state.worker_bridge


@router.websocket("/ws/worker")
async def worker_websocket(ws: WebSocket):
    # Check auth before accepting
    auth = ws.headers.get("authorization", "")
    expected = f"Bearer {settings.worker_auth_token}"
    if not hmac.compare_digest(auth, expected):
        logger.warning("Worker auth failed from %s", ws.client.host if ws.client else "unknown")
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await ws.accept()
    bridge = _get_bridge(ws)
    await bridge.handle_worker(ws)
