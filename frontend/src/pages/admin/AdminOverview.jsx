import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { admin } from '../../api';
import GpuStatsPanel from '../../components/admin/GpuStatsPanel';
import WorkerToggle from '../../components/admin/WorkerToggle';

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="glass-strong rounded-2xl p-5">
      <p className="text-xs text-[var(--color-muted)] uppercase tracking-widest mb-2">{label}</p>
      <p className={`text-2xl font-mono font-bold ${accent ? 'text-[var(--color-accent)]' : ''}`}>
        {value ?? '—'}
      </p>
      {sub && <p className="text-[10px] text-[var(--color-muted-2)] mt-1">{sub}</p>}
    </div>
  );
}

function statusColor(status) {
  switch (status) {
    case 'completed': return 'text-[var(--color-success)]';
    case 'failed': return 'text-[var(--color-danger)]';
    case 'processing': return 'text-[var(--color-accent)]';
    case 'pending': case 'queued': return 'text-[var(--color-warning)]';
    default: return 'text-[var(--color-muted)]';
  }
}

export default function AdminOverview() {
  const [stats, setStats] = useState(null);
  const [recentJobs, setRecentJobs] = useState([]);

  useEffect(() => {
    admin.getStats().then(setStats).catch(() => {});
    admin.getJobs({ limit: 5 }).then((data) => setRecentJobs(data.jobs || [])).catch(() => {});
  }, []);

  return (
    <div className="max-w-6xl space-y-6">
      <h1 className="text-xl font-bold">Overview</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Jobs" value={stats?.total_jobs} />
        <StatCard label="Completed" value={stats?.completed_jobs} accent />
        <StatCard label="Failed" value={stats?.failed_jobs} />
        <StatCard label="Today" value={stats?.jobs_today} sub="uploads in last 24h" />
      </div>

      {/* GPU + Worker */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GpuStatsPanel />
        <WorkerToggle />
      </div>

      {/* Recent jobs */}
      <div className="glass-strong rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs text-[var(--color-muted)] uppercase tracking-widest font-medium">Recent Jobs</h3>
          <Link to="/admin/jobs" className="text-xs text-[var(--color-accent)] hover:underline">View all</Link>
        </div>

        {recentJobs.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-2)]">No jobs yet</p>
        ) : (
          <div className="space-y-2">
            {recentJobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  <code className="text-xs text-[var(--color-muted-2)] font-mono shrink-0">
                    {job.id.slice(0, 8)}
                  </code>
                  <span className={`text-xs font-medium ${statusColor(job.status)}`}>
                    {job.status}
                  </span>
                </div>
                <span className="text-[10px] text-[var(--color-muted-2)] font-mono">
                  {new Date(job.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick stats row */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Avg Time" value={stats.avg_processing_time ? `${Math.round(stats.avg_processing_time)}s` : '—'} />
          <StatCard label="Pending Reports" value={stats.pending_reports} />
          <StatCard label="Active Bans" value={stats.active_bans} />
          <StatCard label="Uploads/24h Limit" value={stats.rate_limit} />
        </div>
      )}
    </div>
  );
}
