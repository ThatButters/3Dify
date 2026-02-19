"""GPU monitoring via nvidia-smi."""

import subprocess
import time
import logging

logger = logging.getLogger(__name__)


def get_gpu_status() -> dict:
    """Query GPU status via nvidia-smi. Returns dict with VRAM, utilization, temp, power."""
    try:
        result = subprocess.run(
            [
                'nvidia-smi',
                '--query-gpu=name,memory.free,memory.used,memory.total,'
                'utilization.gpu,temperature.gpu,power.draw',
                '--format=csv,noheader,nounits',
            ],
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode != 0:
            logger.error(f"nvidia-smi failed: {result.stderr.strip()}")
            return {'available': False, 'error': result.stderr.strip()}

        parts = [p.strip() for p in result.stdout.strip().split(',')]
        gpu_name = parts[0]
        free_mb = float(parts[1])
        used_mb = float(parts[2])
        total_mb = float(parts[3])
        util_pct = int(parts[4])
        temp_c = int(parts[5])
        power_w = float(parts[6]) if parts[6] not in ('[N/A]', '') else 0.0

        return {
            'gpu_name': gpu_name,
            'vram_free_gb': round(free_mb / 1024, 2),
            'vram_used_gb': round(used_mb / 1024, 2),
            'vram_total_gb': round(total_mb / 1024, 2),
            'utilization_pct': util_pct,
            'temp_c': temp_c,
            'power_w': power_w,
            'available': True,
        }
    except FileNotFoundError:
        logger.error("nvidia-smi not found")
        return {'available': False, 'error': 'nvidia-smi not found'}
    except subprocess.TimeoutExpired:
        logger.error("nvidia-smi timed out")
        return {'available': False, 'error': 'nvidia-smi timeout'}
    except Exception as e:
        logger.error(f"GPU status error: {e}")
        return {'available': False, 'error': str(e)}


def is_gpu_available(min_vram_gb: float = 10.0, max_util_pct: int = 15) -> bool:
    """Check if GPU has enough free VRAM and low utilization."""
    status = get_gpu_status()
    if not status.get('available'):
        return False
    return (status['vram_free_gb'] >= min_vram_gb and
            status['utilization_pct'] <= max_util_pct)


def wait_for_gpu(min_vram_gb: float = 10.0, max_util_pct: int = 15,
                 poll_interval: int = 30, cooldown: int = 5,
                 status_callback=None) -> None:
    """
    Block until GPU is available.

    Double-checks after cooldown to avoid catching GPU in a brief transition
    (e.g., a game loading screen or a short CUDA kernel).
    """
    while True:
        if is_gpu_available(min_vram_gb, max_util_pct):
            time.sleep(cooldown)
            if is_gpu_available(min_vram_gb, max_util_pct):
                logger.info("GPU is available (confirmed after cooldown)")
                return
            logger.info("GPU availability was transient, continuing to wait...")

        status = get_gpu_status()
        msg = (f"GPU busy: {status.get('vram_free_gb', 0):.1f}GB free, "
               f"{status.get('utilization_pct', '?')}% util — "
               f"waiting {poll_interval}s")
        logger.info(msg)
        if status_callback:
            status_callback(msg)
        time.sleep(poll_interval)
