import { useState } from 'react';
import { getThumbnailUrl } from '../api';
import ReportModal from './ReportModal';

export default function GalleryCard({ item, onClick }) {
  const [showReport, setShowReport] = useState(false);

  return (
    <>
      <div
        className="glass rounded-xl overflow-hidden cursor-pointer hover:border-[var(--color-accent)]/20 transition-all group"
        onClick={onClick}
      >
        <div className="aspect-square bg-[var(--color-surface-2)] flex items-center justify-center overflow-hidden">
          {item.thumbnail_url ? (
            <img
              src={getThumbnailUrl(item.job_id)}
              alt="Model thumbnail"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <span className="text-3xl">🧊</span>
          )}
        </div>
        <div className="p-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-[var(--color-muted)]">
              {item.vertex_count?.toLocaleString()}v
            </span>
            <span className="text-xs font-mono text-[var(--color-muted-2)]">
              {item.generation_time_s?.toFixed(0)}s
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--color-muted-2)]">
              {item.completed_at ? new Date(item.completed_at).toLocaleDateString() : ''}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); setShowReport(true); }}
              className="text-[var(--color-muted-2)] opacity-0 group-hover:opacity-100 hover:text-[var(--color-muted)] transition-all"
              title="Report"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {showReport && (
        <ReportModal jobId={item.job_id} onClose={() => setShowReport(false)} />
      )}
    </>
  );
}
