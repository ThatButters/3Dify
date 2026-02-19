import { useState, useEffect, useCallback } from 'react';
import { admin } from '../../api';
import AuditTable from '../../components/admin/AuditTable';

export default function AdminAudit() {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const limit = 30;

  const fetchLog = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (actionFilter) params.action = actionFilter;
      const data = await admin.getAuditLog(params);
      setEntries(data.entries || data.logs || []);
      setTotal(data.total || 0);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter]);

  useEffect(() => { fetchLog(); }, [fetchLog]);

  const handleExportCsv = () => {
    if (entries.length === 0) return;
    const headers = ['Time', 'Action', 'Actor', 'Target', 'Details'];
    const rows = entries.map((e) => [
      new Date(e.created_at).toISOString(),
      e.action || '',
      e.actor_ip || e.actor || '',
      e.target_id || '',
      (e.details || '').replace(/"/g, '""'),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Audit Log</h1>
        <button
          onClick={handleExportCsv}
          disabled={entries.length === 0}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 disabled:opacity-50"
        >
          Export CSV
        </button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Filter by action (e.g. upload, ban, delete)..."
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2 text-xs w-72 focus:outline-none focus:border-[var(--color-accent)] transition-colors"
        />
        <span className="text-xs text-[var(--color-muted-2)] font-mono">{total} entries</span>
      </div>

      {/* Table */}
      <div className="glass-strong rounded-2xl overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-[var(--color-muted-2)]">Loading...</p>
        ) : (
          <AuditTable entries={entries} />
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-lg text-xs text-[var(--color-muted)] hover:text-white hover:bg-white/5 disabled:opacity-30"
          >
            Previous
          </button>
          <span className="text-xs text-[var(--color-muted-2)] font-mono">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 rounded-lg text-xs text-[var(--color-muted)] hover:text-white hover:bg-white/5 disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
