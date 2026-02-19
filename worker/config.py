"""Configuration for the img2stl worker service.

All sensitive values (AUTH_TOKEN, VPS_WS_URL) should be set via environment
variables or a .env file — never hardcode secrets in this file.
"""

import os
from pathlib import Path

# Resolve paths relative to this file's location
_WORKER_DIR = Path(__file__).resolve().parent
_PROJECT_DIR = _WORKER_DIR.parent

# Connection — set via env vars
VPS_WS_URL = os.environ.get("VPS_WS_URL", "ws://localhost:8080/ws/worker")
AUTH_TOKEN = os.environ.get("WORKER_AUTH_TOKEN", "")

# GPU thresholds
MIN_FREE_VRAM_GB = 10.0       # Enough to load + run Hunyuan3D
MIN_FREE_VRAM_GB_LOADED = 2.0 # When pipeline already in VRAM, just need headroom
MAX_GPU_UTIL_PCT = 15          # Catches gaming, video editing, etc.
GPU_POLL_INTERVAL_S = 30
GPU_COOLDOWN_S = 5

# Pipeline defaults (used when server doesn't specify settings)
IMG2STL_DIR = str(_PROJECT_DIR)
HUNYUAN3D_REPO = str(_PROJECT_DIR / "Hunyuan3D-2.1")
DEFAULT_STEPS = 50
DEFAULT_GUIDANCE = 5.0
DEFAULT_OCTREE_RES = 384
DEFAULT_HEIGHT_MM = 100.0
DEFAULT_SEED = 42

# WebSocket
WS_MAX_SIZE = 100 * 1024 * 1024  # 100MB — STLs can be 30-50MB, base64 adds ~33%

# Worker
WORKER_VERSION = "1.0.0"
HEARTBEAT_INTERVAL_S = 30
RECONNECT_BASE_S = 5
RECONNECT_MAX_S = 60
TEMP_DIR = "/tmp/img2stl_worker"
LOG_DIR = str(_WORKER_DIR / "logs")
