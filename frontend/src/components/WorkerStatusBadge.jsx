import useWorkerStatus from '../hooks/useWorkerStatus';

export default function WorkerStatusBadge() {
  const status = useWorkerStatus();

  if (!status) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span className="w-2 h-2 rounded-full bg-gray-600" />
        Server unreachable
      </div>
    );
  }

  const online = status.worker_connected;
  const paused = status.paused;

  let color = 'bg-emerald-500';
  let label = 'GPU Online';
  if (paused) {
    color = 'bg-yellow-500';
    label = 'GPU Paused';
  } else if (!online) {
    color = 'bg-red-500';
    label = 'GPU Offline';
  }

  return (
    <div className="flex items-center gap-2 text-xs text-gray-400">
      <span className={`w-2 h-2 rounded-full ${color} ${online && !paused ? 'animate-pulse' : ''}`} />
      {label}
    </div>
  );
}
