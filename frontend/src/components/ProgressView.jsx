const STEP_LABELS = {
  queued: 'In queue',
  waiting_gpu: 'Waiting for GPU',
  removing_background: 'Removing background',
  loading_model: 'Loading AI model',
  generating_mesh: 'Generating mesh',
  repairing_mesh: 'Repairing mesh',
  exporting: 'Exporting files',
  complete: 'Complete!',
};

const STEPS = [
  'queued',
  'waiting_gpu',
  'removing_background',
  'loading_model',
  'generating_mesh',
  'repairing_mesh',
  'exporting',
];

export default function ProgressView({ step, pct, message, queuePosition }) {
  // If no step yet or status is pending, show queued
  const effectiveStep = step || 'queued';
  const currentIdx = STEPS.indexOf(effectiveStep);
  const percent = pct ?? 0;
  const isQueued = effectiveStep === 'queued';

  return (
    <div className="w-full max-w-xl mx-auto page-enter">
      {/* Top progress bar */}
      <div className="h-1 w-full bg-[var(--color-surface-3)] rounded-full mb-10 overflow-hidden">
        <div
          className="h-full rounded-full animate-gradient transition-all duration-500 ease-out"
          style={{
            width: `${Math.max(percent, 2)}%`,
            background: 'linear-gradient(90deg, var(--color-accent), var(--color-accent-2))',
          }}
        />
      </div>

      <p className="text-sm sm:text-base text-[var(--color-muted)] text-center mb-6 italic">
        {isQueued
          ? "Your photo is in line. The GPU is a one-at-a-time kind of gal."
          : "Your model is being hallucinated into existence by a graphics card in someone's living room."}
      </p>

      <div className="glass-strong rounded-2xl p-8 glow-accent-sm">
        {/* Header with percentage */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[var(--color-surface-3)] flex items-center justify-center">
              {isQueued ? (
                <svg className="w-6 h-6 text-[var(--color-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-[var(--color-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5" />
                </svg>
              )}
            </div>
            <div>
              <p className="text-sm font-medium">{isQueued ? 'Queued' : 'Processing'}</p>
              <p className="text-xs text-[var(--color-muted)] font-mono">
                {isQueued && queuePosition
                  ? `Position #${queuePosition} in queue`
                  : message || STEP_LABELS[effectiveStep] || 'Starting...'}
              </p>
            </div>
          </div>
          {isQueued && queuePosition ? (
            <span className="text-2xl font-bold font-mono text-gradient">#{queuePosition}</span>
          ) : (
            <span className="text-2xl font-bold font-mono text-gradient">{percent}%</span>
          )}
        </div>

        {/* Steps */}
        <div className="space-y-2.5">
          {STEPS.map((s, i) => {
            let state = 'pending';
            if (i < currentIdx) state = 'done';
            else if (i === currentIdx) state = 'active';

            return (
              <div
                key={s}
                className={`flex items-center gap-3 py-2 px-3 rounded-lg ${
                  state === 'active'
                    ? 'bg-[var(--color-accent)]/5 border border-[var(--color-accent)]/10'
                    : ''
                }`}
              >
                {state === 'done' && (
                  <div className="w-5 h-5 rounded-full bg-[var(--color-success)]/20 flex items-center justify-center">
                    <svg className="w-3 h-3 text-[var(--color-success)]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
                {state === 'active' && (
                  <div className="w-5 h-5 rounded-full bg-[var(--color-accent)]/20 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] fade-pulse" />
                  </div>
                )}
                {state === 'pending' && (
                  <div className="w-5 h-5 rounded-full bg-[var(--color-surface-3)] flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-muted-2)]" />
                  </div>
                )}
                <span className={`text-sm ${
                  state === 'active' ? 'text-white font-medium' :
                  state === 'done' ? 'text-[var(--color-muted)]' :
                  'text-[var(--color-muted-2)]'
                }`}>
                  {STEP_LABELS[s]}
                </span>
                {state === 'active' && s === 'queued' && queuePosition && (
                  <span className="text-xs font-mono text-[var(--color-accent)] ml-auto">~{queuePosition * 3} min</span>
                )}
                {state === 'active' && s === 'generating_mesh' && message && (
                  <span className="text-xs font-mono text-[var(--color-accent)] ml-auto">{message}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* ETA footer */}
        <div className="mt-8 pt-6 border-t border-[var(--color-border)] flex items-center justify-between">
          <span className="text-xs font-mono text-[var(--color-muted)]">
            {isQueued ? 'Estimated wait' : 'Progress'}
          </span>
          <span className="text-sm font-mono font-medium">
            {isQueued && queuePosition ? `~${queuePosition * 3} min` : `${percent}%`}
          </span>
        </div>
      </div>
    </div>
  );
}
