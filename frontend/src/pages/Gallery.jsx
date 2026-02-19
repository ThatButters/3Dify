import { useEffect, useState } from 'react';
import GalleryCard from '../components/GalleryCard';
import ModelViewer from '../components/ModelViewer';
import { getGallery, getGlbUrl, getStlUrl } from '../api';

export default function Gallery() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    getGallery(20, 0)
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 page-enter">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Gallery</h1>
          <p className="text-sm text-[var(--color-muted)] mt-1">Community creations</p>
        </div>
        <div className="text-xs font-mono text-[var(--color-muted-2)]">{items.length} models</div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <svg className="w-6 h-6 text-[var(--color-accent)] animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20">
          <span className="text-4xl">🧊</span>
          <p className="text-[var(--color-muted)] mt-3">No models in the gallery yet.</p>
          <p className="text-sm text-[var(--color-muted-2)] mt-1">Upload a photo and rate it 4+ stars to add it here!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map((item) => (
            <GalleryCard
              key={item.job_id}
              item={item}
              onClick={() => setSelected(item)}
            />
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative glass-strong rounded-2xl p-6 w-full max-w-2xl space-y-4 page-enter"
            onClick={(e) => e.stopPropagation()}
          >
            <ModelViewer glbUrl={getGlbUrl(selected.job_id)} />
            <div className="flex gap-3">
              <a
                href={getStlUrl(selected.job_id)}
                download
                className="flex-1 py-2.5 rounded-xl btn-accent text-center text-sm font-medium"
              >
                Download STL
              </a>
              <a
                href={getGlbUrl(selected.job_id)}
                download
                className="flex-1 py-2.5 rounded-xl glass-strong hover:bg-[var(--color-surface-3)] text-center text-sm font-medium text-[var(--color-muted)] hover:text-white transition-colors"
              >
                Download GLB
              </a>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <svg className="w-5 h-5 text-[var(--color-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
