import { useState } from 'react';
import { admin, getThumbnailUrl } from '../../api';

function statusBadge(status) {
  const colors = {
    completed: 'bg-[var(--color-success)]/10 text-[var(--color-success)]',
    failed: 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]',
    processing: 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]',
    pending: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]',
    queued: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]',
    cancelled: 'bg-[var(--color-muted)]/10 text-[var(--color-muted)]',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider ${colors[status] || colors.cancelled}`}>
      {status}
    </span>
  );
}

function ExpandedRow({ job, onAction }) {
  const [actionLoading, setActionLoading] = useState('');

  const handleAction = async (action) => {
    setActionLoading(action);
    try {
      await onAction(job.id, action);
    } finally {
      setActionLoading('');
    }
  };

  return (
    <tr>
      <td colSpan="6" className="px-4 py-4 bg-[var(--color-surface-2)]">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs mb-4">
          <div>
            <span className="text-[var(--color-muted)]">Full ID:</span>
            <p className="font-mono mt-0.5 break-all">{job.id}</p>
          </div>
          <div>
            <span className="text-[var(--color-muted)]">IP:</span>
            <p className="font-mono mt-0.5">{job.client_ip || '—'}</p>
          </div>
          <div>
            <span className="text-[var(--color-muted)]">Duration:</span>
            <p className="font-mono mt-0.5">{job.processing_time ? `${Math.round(job.processing_time)}s` : '—'}</p>
          </div>
          <div>
            <span className="text-[var(--color-muted)]">File hash:</span>
            <p className="font-mono mt-0.5 break-all">{job.file_hash?.slice(0, 16) || '—'}</p>
          </div>
          {job.error && (
            <div className="col-span-full">
              <span className="text-[var(--color-muted)]">Error:</span>
              <p className="font-mono mt-0.5 text-[var(--color-danger)]">{job.error}</p>
            </div>
          )}
          {job.gpu_metrics && (
            <div className="col-span-full">
              <span className="text-[var(--color-muted)]">GPU Metrics:</span>
              <p className="font-mono mt-0.5">
                Peak VRAM: {job.gpu_metrics.peak_vram_mb ? `${(job.gpu_metrics.peak_vram_mb / 1024).toFixed(1)} GB` : '—'}
                {' · '}Energy: {job.gpu_metrics.gpu_energy_j ? `${Math.round(job.gpu_metrics.gpu_energy_j)} J` : '—'}
                {' · '}Avg Util: {job.gpu_metrics.avg_gpu_util_pct ? `${job.gpu_metrics.avg_gpu_util_pct}%` : '—'}
                {' · '}Peak Temp: {job.gpu_metrics.peak_temp_c ? `${job.gpu_metrics.peak_temp_c}°C` : '—'}
              </p>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {(job.status === 'failed' || job.status === 'cancelled') && (
            <button
              onClick={() => handleAction('retry')}
              disabled={!!actionLoading}
              className="px-3 py-1.5 rounded-lg text-xs bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 disabled:opacity-50"
            >
              {actionLoading === 'retry' ? '...' : 'Retry'}
            </button>
          )}
          {(job.status === 'pending' || job.status === 'queued' || job.status === 'processing') && (
            <button
              onClick={() => handleAction('cancel')}
              disabled={!!actionLoading}
              className="px-3 py-1.5 rounded-lg text-xs bg-[var(--color-warning)]/10 text-[var(--color-warning)] hover:bg-[var(--color-warning)]/20 disabled:opacity-50"
            >
              {actionLoading === 'cancel' ? '...' : 'Cancel'}
            </button>
          )}
          <button
            onClick={() => handleAction('delete')}
            disabled={!!actionLoading}
            className="px-3 py-1.5 rounded-lg text-xs bg-[var(--color-danger)]/10 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/20 disabled:opacity-50"
          >
            {actionLoading === 'delete' ? '...' : 'Delete'}
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function JobsTable({ jobs, onAction }) {
  const [expanded, setExpanded] = useState(null);

  const toggle = (id) => setExpanded(expanded === id ? null : id);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] text-[var(--color-muted)] uppercase tracking-widest border-b border-[var(--color-border)]">
            <th className="pb-3 px-4 font-medium">ID</th>
            <th className="pb-3 px-4 font-medium">Status</th>
            <th className="pb-3 px-4 font-medium hidden md:table-cell">Created</th>
            <th className="pb-3 px-4 font-medium hidden lg:table-cell">Duration</th>
            <th className="pb-3 px-4 font-medium hidden lg:table-cell">Vertices</th>
            <th className="pb-3 px-4 font-medium w-8"></th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <>
              <tr
                key={job.id}
                onClick={() => toggle(job.id)}
                className="border-b border-[var(--color-border)] hover:bg-white/[0.02] cursor-pointer transition-colors"
              >
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    {job.thumbnail_url && (
                      <img
                        src={getThumbnailUrl(job.id)}
                        alt=""
                        className="w-8 h-8 rounded object-cover bg-[var(--color-surface-2)]"
                      />
                    )}
                    <code className="text-xs font-mono text-[var(--color-muted-2)]">
                      {job.id.slice(0, 8)}
                    </code>
                  </div>
                </td>
                <td className="py-3 px-4">{statusBadge(job.status)}</td>
                <td className="py-3 px-4 hidden md:table-cell text-xs text-[var(--color-muted-2)] font-mono">
                  {new Date(job.created_at).toLocaleString()}
                </td>
                <td className="py-3 px-4 hidden lg:table-cell text-xs font-mono">
                  {job.processing_time ? `${Math.round(job.processing_time)}s` : '—'}
                </td>
                <td className="py-3 px-4 hidden lg:table-cell text-xs font-mono">
                  {job.vertex_count?.toLocaleString() || '—'}
                </td>
                <td className="py-3 px-4 text-[var(--color-muted)]">
                  <svg className={`w-4 h-4 transition-transform ${expanded === job.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </td>
              </tr>
              {expanded === job.id && <ExpandedRow key={`${job.id}-exp`} job={job} onAction={onAction} />}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
