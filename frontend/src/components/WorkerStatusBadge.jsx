import useWorkerStatus from '../hooks/useWorkerStatus';

export default function WorkerStatusBadge() {
  const status = useWorkerStatus();

  if (!status) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-surface-3)]">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-muted-2)]" />
        <span className="text-xs font-mono text-[var(--color-muted-2)]">Offline</span>
      </div>
    );
  }

  const online = status.worker_connected;
  const paused = status.paused;

  let dotClass = 'bg-[var(--color-success)] fade-pulse';
  let label = 'Online';
  let pillBg = 'bg-[var(--color-success)]/10';
  let pillBorder = 'border-[var(--color-success)]/20';
  let textClass = 'text-[var(--color-success)]';

  if (paused) {
    dotClass = 'bg-[var(--color-warning)]';
    label = 'Paused';
    pillBg = 'bg-[var(--color-warning)]/10';
    pillBorder = 'border-[var(--color-warning)]/20';
    textClass = 'text-[var(--color-warning)]';
  } else if (!online) {
    dotClass = 'bg-[var(--color-danger)]';
    label = 'Offline';
    pillBg = 'bg-[var(--color-danger)]/10';
    pillBorder = 'border-[var(--color-danger)]/20';
    textClass = 'text-[var(--color-danger)]';
  }

  return (
    <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full ${pillBg} border ${pillBorder}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
      <span className={`text-xs font-mono ${textClass}`}>{label}</span>
    </div>
  );
}
