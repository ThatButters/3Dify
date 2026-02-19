import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import useJobWebSocket from '../hooks/useJobWebSocket';
import ProgressView from '../components/ProgressView';
import ResultsView from '../components/ResultsView';
import { getJob } from '../api';

export default function JobPage() {
  const { jobId } = useParams();
  const { progress, result, error: wsError } = useJobWebSocket(jobId);
  const [job, setJob] = useState(null);
  const [pollError, setPollError] = useState(null);

  // Fetch initial job state
  useEffect(() => {
    if (!jobId) return;
    getJob(jobId)
      .then(setJob)
      .catch((err) => setPollError(err.message));
  }, [jobId]);

  // When WS reports complete, re-fetch the full job data
  useEffect(() => {
    if (result && jobId) {
      getJob(jobId).then(setJob);
    }
  }, [result, jobId]);

  // Determine what to show
  const isComplete = job?.status === 'complete';
  const isFailed = job?.status === 'failed' || wsError;
  const isProcessing = !isComplete && !isFailed;

  // Update job progress from WS
  const currentStep = progress?.step || job?.current_step;
  const currentPct = progress?.pct ?? job?.progress_pct ?? 0;
  const currentMessage = progress?.message || job?.progress_message;

  if (pollError) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <div className="text-center space-y-4 page-enter">
          <p className="text-[var(--color-danger)]">{pollError}</p>
          <Link to="/" className="inline-block text-sm text-[var(--color-muted)] hover:text-white transition-colors">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-8">
      {isComplete && job ? (
        <ResultsView job={job} />
      ) : isFailed ? (
        <div className="w-full max-w-lg mx-auto text-center space-y-6 page-enter">
          <div className="glass-strong rounded-2xl p-8 space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-[var(--color-danger)]/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-[var(--color-danger)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold">Generation Failed</h2>
              <p className="text-sm text-[var(--color-muted)] mt-1">
                {wsError?.message || job?.error || 'An unexpected error occurred'}
              </p>
              {(wsError?.step || job?.error_step) && (
                <p className="text-xs text-[var(--color-muted-2)] mt-1 font-mono">
                  Failed at: {wsError?.step || job?.error_step}
                </p>
              )}
            </div>
            <p className="text-xs text-[var(--color-muted-2)]">
              Try again — the GPU may have been busy or the image format unsupported.
            </p>
          </div>
          <Link
            to="/"
            className="inline-block px-6 py-2.5 rounded-xl btn-accent text-sm font-medium"
          >
            Try again
          </Link>
        </div>
      ) : (
        <ProgressView step={currentStep} pct={currentPct} message={currentMessage} />
      )}
    </div>
  );
}
