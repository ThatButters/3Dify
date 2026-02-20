export default function ModelViewer({ glbUrl }) {
  return (
    <div className="glass-strong rounded-2xl overflow-hidden glow-accent-sm relative">
      <model-viewer
        src={glbUrl}
        auto-rotate
        camera-controls
        camera-orbit="0deg 75deg auto"
        orientation="0deg -90deg 0deg"
        shadow-intensity="0.5"
        environment-image="neutral"
        style={{
          width: '100%',
          height: '400px',
          background: '#0a0a0a',
        }}
      >
        <div slot="poster" className="flex items-center justify-center h-full text-[var(--color-muted)] text-sm">
          Loading 3D model...
        </div>
      </model-viewer>
      <div className="absolute top-4 left-4 text-xs font-mono text-[var(--color-muted-2)]">Interactive 3D Viewer</div>
    </div>
  );
}
