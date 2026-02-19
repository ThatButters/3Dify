export default function ModelViewer({ glbUrl }) {
  return (
    <div className="rounded-xl overflow-hidden border border-[var(--color-border)] bg-[#0a0a0a]">
      <model-viewer
        src={glbUrl}
        auto-rotate
        camera-controls
        shadow-intensity="0.5"
        environment-image="neutral"
        style={{
          width: '100%',
          height: '400px',
          background: '#0a0a0a',
        }}
      >
        <div slot="poster" className="flex items-center justify-center h-full text-gray-500 text-sm">
          Loading 3D model...
        </div>
      </model-viewer>
    </div>
  );
}
