import { useState, useEffect, useCallback } from 'react';
import { admin } from '../../api';
import JobsTable from '../../components/admin/JobsTable';

const STATUS_FILTERS = ['all', 'pending', 'queued', 'processing', 'completed', 'failed', 'cancelled'];

export default function AdminJobs() {
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const limit = 20;

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (status !== 'all') params.status = status;
      if (search.trim()) params.search = search.trim();
      const data = await admin.getJobs(params);
      setJobs(data.jobs || []);
      setTotal(data.total || 0);
    } catch {
      // keep existing
    } finally {
      setLoading(false);
    }
  }, [page, status, search]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const handleAction = async (jobId, action) => {
    try {
      if (action === 'retry') await admin.retryJob(jobId);
      else if (action === 'cancel') await admin.cancelJob(jobId);
      else if (action === 'delete') {
        if (!window.confirm('Permanently delete this job and its files?')) return;
        await admin.deleteJob(jobId);
      }
      await fetchJobs();
    } catch (err) {
      alert(err.message);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Jobs</h1>
        <span className="text-xs text-[var(--color-muted-2)] font-mono">{total} total</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => { setStatus(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                status === s
                  ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                  : 'text-[var(--color-muted)] hover:text-white hover:bg-white/5'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Search by ID or IP..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="ml-auto bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2 text-xs w-56 focus:outline-none focus:border-[var(--color-accent)] transition-colors"
        />
      </div>

      {/* Table */}
      <div className="glass-strong rounded-2xl overflow-hidden">
        {loading && jobs.length === 0 ? (
          <p className="p-6 text-sm text-[var(--color-muted-2)]">Loading...</p>
        ) : jobs.length === 0 ? (
          <p className="p-6 text-sm text-[var(--color-muted-2)]">No jobs found</p>
        ) : (
          <JobsTable jobs={jobs} onAction={handleAction} />
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
