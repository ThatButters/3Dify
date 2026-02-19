import { useEffect, useState } from 'react';
import { admin } from '../api';

export default function useGpuStats(intervalMs = 5000) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const data = await admin.getGpu();
        if (active) setStats(data);
      } catch {
        if (active) setStats(null);
      }
    }

    poll();
    const id = setInterval(poll, intervalMs);
    return () => { active = false; clearInterval(id); };
  }, [intervalMs]);

  return stats;
}
