import { useEffect, useState } from 'react';
import { getQueueStatus } from '../api';
import useWorkerStatus from '../hooks/useWorkerStatus';

const STATUS_COLORS = {
  pending: 'bg-[var(--color-warning)]',
  processing: 'bg-[var(--color-accent)]',
  complete: 'bg-[var(--color-success)]',
  failed: 'bg-[var(--color-danger)]',
  assigned: 'bg-[var(--color-accent)]',
  expired: 'bg-[var(--color-muted-2)]',
};

export default function QueuePage() {
  const worker = useWorkerStatus(10000);
  const [queue, setQueue] = useState(null);

  useEffect(() => {
    const poll = () => getQueueStatus().then((d) => setQueue(d.queue)).catch(() => {});
    poll();
    const id = setInterval(poll, 10000);
    return () => clearInterval(id);
  }, []);

  const workerOnline = worker?.worker_connected;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 page-enter">
      <div className="w-full max-w-sm">
        <h2 className="text-xl font-bold text-center mb-8">System Status</h2>

        {/* Worker card */}
        <div className="glass-strong rounded-2xl p-6 mb-4">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              workerOnline
                ? 'bg-[var(--color-success)]/10'
                : workerOnline === false
                  ? 'bg-[var(--color-danger)]/10'
                  : 'bg-[var(--color-surface-3)]'
            }`}>
              <div className={`w-3 h-3 rounded-full ${
                workerOnline
                  ? 'bg-[var(--color-success)] fade-pulse'
                  : workerOnline === false
                    ? 'bg-[var(--color-danger)]'
                    : 'bg-[var(--color-muted-2)]'
              }`} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">GPU Worker</p>
              <p className="text-xs text-[var(--color-muted)] font-mono">RTX 5070 Ti</p>
            </div>
            <span className={`text-xs font-mono ${
              workerOnline
                ? 'text-[var(--color-success)]'
                : workerOnline === false
                  ? 'text-[var(--color-danger)]'
                  : 'text-[var(--color-muted-2)]'
            }`}>
              {workerOnline ? 'Online' : workerOnline === false ? 'Offline' : 'Checking...'}
            </span>
          </div>
          {worker?.paused && (
            <p className="text-xs text-[var(--color-warning)] mt-3 ml-16">Worker is paused</p>
          )}
        </div>

        {/* Queue stats */}
        {queue && (
          <div className="glass-strong rounded-2xl p-6">
            <div className="space-y-4">
              {['pending', 'processing', 'complete', 'failed', 'assigned', 'expired'].map((key) => (
                <div key={key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[key]}`} />
                    <span className="text-sm text-[var(--color-muted)] capitalize">{key}</span>
                  </div>
                  <span className="text-sm font-mono font-semibold">{queue[key] || 0}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-4 border-t border-[var(--color-border)]">
              <p className="text-xs text-[var(--color-muted-2)] text-center font-mono">
                Refreshes every 10 seconds
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
