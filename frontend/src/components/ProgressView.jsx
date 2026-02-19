const STEP_LABELS = {
  waiting_gpu: 'Waiting for GPU to be free...',
  removing_background: 'Removing background...',
  loading_model: 'Loading AI model (first job takes ~90s)...',
  generating_mesh: 'Generating 3D mesh...',
  repairing_mesh: 'Repairing mesh for printing...',
  exporting: 'Exporting files...',
  complete: 'Complete!',
};

const STEPS = [
  'waiting_gpu',
  'removing_background',
  'loading_model',
  'generating_mesh',
  'repairing_mesh',
  'exporting',
];

export default function ProgressView({ step, pct, message }) {
  const currentIdx = STEPS.indexOf(step);
  const label = STEP_LABELS[step] || message || 'Starting...';

  return (
    <div className="w-full max-w-lg mx-auto space-y-6 page-enter">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-gray-500 font-mono">
          <span>{label}</span>
          <span>{pct ?? 0}%</span>
        </div>
        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500 progress-active transition-all duration-500 ease-out"
            style={{ width: `${Math.max(pct ?? 0, 2)}%` }}
          />
        </div>
      </div>

      {/* Step indicators */}
      <div className="space-y-2">
        {STEPS.map((s, i) => {
          let state = 'pending';
          if (i < currentIdx) state = 'done';
          else if (i === currentIdx) state = 'active';

          return (
            <div key={s} className="flex items-center gap-3 text-sm">
              {state === 'done' && (
                <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {state === 'active' && (
                <svg className="w-4 h-4 text-blue-500 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {state === 'pending' && (
                <div className="w-4 h-4 rounded-full border border-gray-700 shrink-0" />
              )}
              <span className={
                state === 'active' ? 'text-white' :
                state === 'done' ? 'text-gray-500' : 'text-gray-600'
              }>
                {STEP_LABELS[s]}
              </span>
            </div>
          );
        })}
      </div>

      {/* Live message */}
      {message && message !== label && (
        <p className="text-xs text-gray-500 font-mono text-center">{message}</p>
      )}
    </div>
  );
}
