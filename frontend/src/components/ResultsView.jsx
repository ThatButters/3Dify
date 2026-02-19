import { useState } from 'react';
import ModelViewer from './ModelViewer';
import StarRating from './StarRating';
import ReportModal from './ReportModal';
import { getStlUrl, getGlbUrl, submitFeedback } from '../api';

function StatItem({ label, value }) {
  return (
    <div className="text-center">
      <div className="text-lg font-mono font-semibold text-white">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

export default function ResultsView({ job }) {
  const [showReport, setShowReport] = useState(false);

  const handleFeedback = async (rating) => {
    await submitFeedback(job.job_id, rating);
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 page-enter">
      {/* 3D Viewer */}
      <ModelViewer glbUrl={getGlbUrl(job.job_id)} />

      {/* Stats */}
      <div className="glass rounded-xl p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatItem label="Vertices" value={job.vertex_count?.toLocaleString()} />
          <StatItem label="Faces" value={job.face_count?.toLocaleString()} />
          <StatItem
            label="Watertight"
            value={job.is_watertight ? '✓ Yes' : '✗ No'}
          />
          <StatItem
            label="Gen Time"
            value={`${job.generation_time_s?.toFixed(1)}s`}
          />
        </div>
      </div>

      {/* Downloads */}
      <div className="flex gap-3">
        <a
          href={getStlUrl(job.job_id)}
          download
          className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-center text-sm font-medium transition-colors"
        >
          Download STL
        </a>
        {job.glb_url && (
          <a
            href={getGlbUrl(job.job_id)}
            download
            className="flex-1 py-3 rounded-xl bg-white/5 border border-[var(--color-border)] hover:bg-white/10 text-center text-sm font-medium transition-colors"
          >
            Download GLB
          </a>
        )}
      </div>

      {/* Rating + Report */}
      <div className="flex items-center justify-between">
        <StarRating onSubmit={handleFeedback} />
        <button
          onClick={() => setShowReport(true)}
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          Report
        </button>
      </div>

      {showReport && (
        <ReportModal jobId={job.job_id} onClose={() => setShowReport(false)} />
      )}
    </div>
  );
}
