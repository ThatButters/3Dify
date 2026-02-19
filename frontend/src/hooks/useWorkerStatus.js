import { useEffect, useState } from 'react';
import { getHealth } from '../api';

export default function useWorkerStatus(intervalMs = 30000) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const data = await getHealth();
        if (active) setStatus({ ...data, lastSeen: new Date() });
      } catch {
        if (active) setStatus((prev) => prev ? { ...prev, worker_connected: false } : null);
      }
    }

    poll();
    const id = setInterval(poll, intervalMs);
    return () => { active = false; clearInterval(id); };
  }, [intervalMs]);

  return status;
}
