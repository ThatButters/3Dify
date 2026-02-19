import { useEffect, useState } from 'react';
import { getQueueStatus } from '../api';
import useWorkerStatus from '../hooks/useWorkerStatus';

function StatCard({ label, value, mono }) {
  return (
    <div className="glass rounded-xl p-5 text-center">
      <div className={`text-2xl font-semibold ${mono ? 'font-mono' : ''}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

export default function QueuePage() {
  const worker = useWorkerStatus(10000);
  const [queue, setQueue] = useState(null);

  useEffect(() => {
    const fetch = () => getQueueStatus().then((d) => setQueue(d.queue)).catch(() => {});
    fetch();
    const id = setInterval(fetch, 10000);
    return () => clearInterval(id);
  }, []);

  const workerOnline = worker?.worker_connected;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8 page-enter">
      <div>
        <h1 className="text-2xl font-bold">Queue Status</h1>
        <p className="text-sm text-gray-500 mt-1">Live system status</p>
      </div>

      {/* Worker status */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full ${
            workerOnline === true ? 'bg-emerald-500 animate-pulse' :
            workerOnline === false ? 'bg-red-500' : 'bg-gray-600'
          }`} />
          <div>
            <p className="font-medium">
              {workerOnline === true ? 'GPU Worker Online' :
               workerOnline === false ? 'GPU Worker Offline' : 'Checking...'}
            </p>
            {worker?.paused && (
              <p className="text-xs text-yellow-500 mt-0.5">Worker is paused</p>
            )}
          </div>
        </div>
      </div>

      {/* Queue counts */}
      {queue && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <StatCard label="Pending" value={queue.pending || 0} mono />
          <StatCard label="Processing" value={queue.processing || 0} mono />
          <StatCard label="Completed" value={queue.complete || 0} mono />
          <StatCard label="Failed" value={queue.failed || 0} mono />
          <StatCard label="Assigned" value={queue.assigned || 0} mono />
          <StatCard label="Expired" value={queue.expired || 0} mono />
        </div>
      )}

      <p className="text-xs text-gray-600 text-center">
        Jobs expire after 72 hours. Queue refreshes every 10 seconds.
      </p>
    </div>
  );
}
