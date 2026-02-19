import { useState, useEffect } from 'react';
import { admin } from '../../api';

export default function WorkerToggle() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchStatus = async () => {
    try {
      const data = await admin.getWorkerStatus();
      setStatus(data);
    } catch {
      setStatus(null);
    }
  };

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 10000);
    return () => clearInterval(id);
  }, []);

  const handleToggle = async () => {
    if (!status) return;

    const action = status.paused ? 'resume' : 'pause';
    if (action === 'pause') {
      const ok = window.confirm('This will stop job processing. Jobs already in queue will remain. Continue?');
      if (!ok) return;
    }

    setLoading(true);
    try {
      if (action === 'pause') {
        await admin.pauseWorker();
      } else {
        await admin.resumeWorker();
      }
      await fetchStatus();
    } catch {
      // Revert on error
      await fetchStatus();
    } finally {
      setLoading(false);
    }
  };

  const paused = status?.paused;
  const connected = status?.connected;

  return (
    <div className="glass-strong rounded-2xl p-6">
      <h3 className="text-xs text-[var(--color-muted)] uppercase tracking-widest mb-4 font-medium">Worker Control</h3>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${
            !connected ? 'bg-[var(--color-danger)]' :
            paused ? 'bg-[var(--color-warning)]' :
            'bg-[var(--color-success)] fade-pulse'
          }`} />
          <div>
            <p className="text-sm font-medium">
              {!connected ? 'Disconnected' : paused ? 'Paused' : 'Active'}
            </p>
            {status?.last_seen && (
              <p className="text-[10px] text-[var(--color-muted-2)] font-mono">
                Last seen: {new Date(status.last_seen).toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={handleToggle}
          disabled={loading || !connected}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${
            paused
              ? 'bg-[var(--color-success)]/10 text-[var(--color-success)] hover:bg-[var(--color-success)]/20'
              : 'bg-[var(--color-warning)]/10 text-[var(--color-warning)] hover:bg-[var(--color-warning)]/20'
          }`}
        >
          {loading ? '...' : paused ? 'Resume Processing' : 'Pause Processing'}
        </button>
      </div>
    </div>
  );
}
