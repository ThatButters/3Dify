import useGpuStats from '../../hooks/useGpuStats';

export default function GpuStatsPanel() {
  const gpu = useGpuStats(5000);

  if (!gpu) {
    return (
      <div className="glass-strong rounded-2xl p-6">
        <h3 className="text-xs text-[var(--color-muted)] uppercase tracking-widest mb-4 font-medium">GPU Stats</h3>
        <p className="text-sm text-[var(--color-muted-2)]">No GPU data available</p>
      </div>
    );
  }

  const vramPct = gpu.vram_total_mb > 0 ? (gpu.vram_used_mb / gpu.vram_total_mb) * 100 : 0;

  return (
    <div className="glass-strong rounded-2xl p-6">
      <h3 className="text-xs text-[var(--color-muted)] uppercase tracking-widest mb-4 font-medium">GPU Stats</h3>

      <div className="space-y-4">
        {/* VRAM */}
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-[var(--color-muted)]">VRAM</span>
            <span className="font-mono">
              {(gpu.vram_used_mb / 1024).toFixed(1)} / {(gpu.vram_total_mb / 1024).toFixed(0)} GB
            </span>
          </div>
          <div className="h-2 rounded-full bg-[var(--color-surface-3)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${vramPct}%`,
                background: vramPct > 90 ? 'var(--color-danger)' : vramPct > 70 ? 'var(--color-warning)' : 'var(--color-accent)',
              }}
            />
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-[var(--color-muted)] mb-0.5">Utilization</p>
            <p className="text-lg font-mono font-semibold">{gpu.utilization_pct ?? '—'}%</p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-muted)] mb-0.5">Temp</p>
            <p className={`text-lg font-mono font-semibold ${
              (gpu.temp_c ?? 0) > 80 ? 'text-[var(--color-danger)]' : ''
            }`}>
              {gpu.temp_c ?? '—'}°C
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-muted)] mb-0.5">Power</p>
            <p className="text-lg font-mono font-semibold">{gpu.power_w ?? '—'}W</p>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-[var(--color-muted-2)] mt-4 font-mono">Polling every 5s</p>
    </div>
  );
}
