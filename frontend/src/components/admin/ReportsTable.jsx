import { useState } from 'react';
import { getThumbnailUrl } from '../../api';

export default function ReportsTable({ reports, onDismiss, onRemove }) {
  const [actionLoading, setActionLoading] = useState('');

  const handleAction = async (id, action) => {
    setActionLoading(`${id}-${action}`);
    try {
      if (action === 'dismiss') await onDismiss(id);
      else if (action === 'remove') await onRemove(id);
    } finally {
      setActionLoading('');
    }
  };

  if (reports.length === 0) {
    return <p className="p-6 text-sm text-[var(--color-muted-2)]">No pending reports</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] text-[var(--color-muted)] uppercase tracking-widest border-b border-[var(--color-border)]">
            <th className="pb-3 px-4 font-medium">Job</th>
            <th className="pb-3 px-4 font-medium">Reason</th>
            <th className="pb-3 px-4 font-medium hidden md:table-cell">Details</th>
            <th className="pb-3 px-4 font-medium hidden md:table-cell">Reported</th>
            <th className="pb-3 px-4 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((r) => (
            <tr key={r.id} className="border-b border-[var(--color-border)]">
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  {r.job_id && (
                    <img
                      src={getThumbnailUrl(r.job_id)}
                      alt=""
                      className="w-8 h-8 rounded object-cover bg-[var(--color-surface-2)]"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  )}
                  <code className="text-xs font-mono text-[var(--color-muted-2)]">
                    {r.job_id?.slice(0, 8) || '—'}
                  </code>
                </div>
              </td>
              <td className="py-3 px-4">
                <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-medium bg-[var(--color-danger)]/10 text-[var(--color-danger)]">
                  {r.reason}
                </span>
              </td>
              <td className="py-3 px-4 hidden md:table-cell text-xs text-[var(--color-muted-2)] max-w-xs truncate">
                {r.details || '—'}
              </td>
              <td className="py-3 px-4 hidden md:table-cell text-[10px] text-[var(--color-muted-2)] font-mono">
                {new Date(r.created_at).toLocaleString()}
              </td>
              <td className="py-3 px-4">
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => handleAction(r.id, 'dismiss')}
                    disabled={!!actionLoading}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-[var(--color-muted)]/10 text-[var(--color-muted)] hover:bg-[var(--color-muted)]/20 disabled:opacity-50"
                  >
                    {actionLoading === `${r.id}-dismiss` ? '...' : 'Dismiss'}
                  </button>
                  <button
                    onClick={() => handleAction(r.id, 'remove')}
                    disabled={!!actionLoading}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-[var(--color-danger)]/10 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/20 disabled:opacity-50"
                  >
                    {actionLoading === `${r.id}-remove` ? '...' : 'Remove Job'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
