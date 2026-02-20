import { useState } from 'react';
import { Link } from 'react-router-dom';
import ModelViewer from './ModelViewer';
import StarRating from './StarRating';
import ReportModal from './ReportModal';
import { getStlUrl, getGlbUrl, submitFeedback } from '../api';

function StatItem({ label, value }) {
  return (
    <div>
      <p className="text-xs text-[var(--color-muted)] mb-1">{label}</p>
      <p className="text-lg font-mono font-semibold">{value}</p>
    </div>
  );
}

export default function ResultsView({ job }) {
  const [showReport, setShowReport] = useState(false);

  const handleFeedback = async (rating) => {
    await submitFeedback(job.job_id, rating);
  };

  return (
    <div className="w-full max-w-6xl mx-auto page-enter">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Viewer */}
        <ModelViewer glbUrl={getGlbUrl(job.job_id)} />

        <p className="text-sm sm:text-base text-[var(--color-muted)] text-center italic">
          If it looks wrong, that's the AI's fault. If it looks right, you're welcome.
        </p>

        {/* Stats row */}
        <div className="glass-strong rounded-2xl p-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatItem label="Vertices" value={job.vertex_count?.toLocaleString() || '—'} />
            <StatItem label="Faces" value={job.face_count?.toLocaleString() || '—'} />
            <StatItem label="Time" value={`${job.generation_time_s?.toFixed(1) || '—'}s`} />
            <div>
              <p className="text-xs text-[var(--color-muted)] mb-1">Status</p>
              <span className={`inline-flex items-center gap-1 text-xs font-mono px-2 py-1 rounded-md mt-0.5 ${
                job.is_watertight
                  ? 'text-[var(--color-success)] bg-[var(--color-success)]/10'
                  : 'text-[var(--color-warning)] bg-[var(--color-warning)]/10'
              }`}>
                {job.is_watertight ? (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : null}
                {job.is_watertight ? 'Watertight' : 'Not watertight'}
              </span>
            </div>
          </div>
        </div>

        {/* Downloads */}
        <div className="flex gap-3">
          <a
            href={getStlUrl(job.job_id)}
            download
            className="flex-1 py-3.5 btn-accent text-sm font-semibold rounded-xl glow-accent-sm flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download STL
          </a>
          {job.glb_url && (
            <a
              href={getGlbUrl(job.job_id)}
              download
              className="flex-1 py-3.5 glass-strong text-sm font-medium rounded-xl hover:bg-[var(--color-surface-3)] flex items-center justify-center gap-2 text-[var(--color-muted)] hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download GLB
            </a>
          )}
        </div>

        {/* Rating */}
        <div className="glass-strong rounded-2xl p-6">
          <h3 className="text-xs text-[var(--color-muted)] uppercase tracking-widest mb-3 font-medium">Rate this result</h3>
          <StarRating onSubmit={handleFeedback} />
        </div>

        <div className="flex flex-col items-center gap-3">
          <Link
            to="/"
            className="py-3.5 px-8 btn-accent text-sm font-semibold rounded-xl glow-accent-sm inline-flex items-center gap-2"
          >
            Convert another photo
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
          <button
            onClick={() => setShowReport(true)}
            className="text-xs text-[var(--color-muted-2)] hover:text-[var(--color-muted)] transition-colors"
          >
            Report issue
          </button>
        </div>
      </div>

      {showReport && (
        <ReportModal jobId={job.job_id} onClose={() => setShowReport(false)} />
      )}
    </div>
  );
}
