"""Per-job GPU metrics sampling.

Runs in a background thread during job processing, sampling nvidia-smi every
1 second to capture peak VRAM, utilization, temperature, and energy consumption.
"""

import threading
import time
import logging

from gpu_monitor import get_gpu_status

logger = logging.getLogger(__name__)


class GPUSampler:
    """Samples GPU metrics at a fixed interval in a background thread."""

    def __init__(self, interval: float = 1.0):
        self.interval = interval
        self._thread = None
        self._stop_event = threading.Event()
        self._samples = []

    def start(self):
        """Start sampling in a background thread."""
        self._stop_event.clear()
        self._samples = []
        self._thread = threading.Thread(target=self._sample_loop, daemon=True)
        self._thread.start()
        logger.debug("GPU sampler started")

    def stop(self) -> dict:
        """Stop sampling and return a summary of collected metrics."""
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=5)
        logger.debug(f"GPU sampler stopped ({len(self._samples)} samples)")
        return self._summarize()

    def _sample_loop(self):
        while not self._stop_event.is_set():
            status = get_gpu_status()
            if status.get('available'):
                self._samples.append({
                    'timestamp': time.time(),
                    'vram_used_gb': status['vram_used_gb'],
                    'utilization_pct': status['utilization_pct'],
                    'temp_c': status['temp_c'],
                    'power_w': status.get('power_w', 0),
                })
            self._stop_event.wait(self.interval)

    def _summarize(self) -> dict:
        """Compute summary statistics from collected samples."""
        if not self._samples:
            return {}

        vram_values = [s['vram_used_gb'] for s in self._samples]
        util_values = [s['utilization_pct'] for s in self._samples]
        power_values = [s['power_w'] for s in self._samples]

        duration = (self._samples[-1]['timestamp'] - self._samples[0]['timestamp']
                    if len(self._samples) > 1 else 0)

        # Energy: integrate power over time (watts × seconds = joules)
        energy_j = 0.0
        for i in range(1, len(self._samples)):
            dt = self._samples[i]['timestamp'] - self._samples[i - 1]['timestamp']
            avg_power = (self._samples[i]['power_w'] + self._samples[i - 1]['power_w']) / 2
            energy_j += avg_power * dt

        return {
            'gpu_time_s': round(duration, 1),
            'gpu_energy_j': round(energy_j),
            'peak_power_w': round(max(power_values)) if power_values else 0,
            'peak_vram_mb': round(max(vram_values) * 1024),
            'avg_gpu_util_pct': round(sum(util_values) / len(util_values)),
            'peak_temp_c': max(s['temp_c'] for s in self._samples),
            'num_samples': len(self._samples),
        }
