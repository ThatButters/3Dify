import { useState } from 'react';
import { submitReport } from '../api';

const REASONS = [
  'Inappropriate / NSFW',
  'Copyright violation',
  'Other',
];

export default function ReportModal({ jobId, onClose }) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitReport(jobId, reason, details);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative glass rounded-xl p-6 w-full max-w-md page-enter"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">Report this content</h2>

        {done ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Thanks for reporting. We'll review this.
            </p>
            <button
              onClick={onClose}
              className="w-full py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Reason</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-[var(--color-border)] text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">Select a reason...</option>
                {REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Details (optional)</label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-[var(--color-border)] text-sm resize-none focus:outline-none focus:border-blue-500"
                placeholder="Any additional context..."
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !reason}
                className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                {submitting ? 'Submitting...' : 'Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
