import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import UploadZone from '../components/UploadZone';
import { useToast } from '../components/Toast';
import { uploadImage, getQueueStatus } from '../api';

export default function Home() {
  const navigate = useNavigate();
  const toast = useToast();
  const [queueDepth, setQueueDepth] = useState(null);

  useEffect(() => {
    getQueueStatus()
      .then((data) => {
        const q = data.queue;
        setQueueDepth((q.pending || 0) + (q.assigned || 0) + (q.processing || 0));
      })
      .catch(() => {});
  }, []);

  const handleUpload = async (file) => {
    try {
      const result = await uploadImage(file);
      localStorage.setItem('lastJobId', result.job_id);
      toast.success('Upload complete — generating your model...');
      navigate(`/job/${result.job_id}`);
    } catch (err) {
      toast.error(err.message || 'Upload failed');
      throw err; // Re-throw so UploadZone can reset its state
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-4 page-enter">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--color-border-2)] text-xs text-[var(--color-muted)] mb-6">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] fade-pulse" />
            Powered by Hunyuan3D 2.1
          </div>
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight mb-4">
            <span className="bg-gradient-to-r from-white via-white to-[var(--color-muted)] bg-clip-text text-transparent">Drop a photo.</span>
            <br />
            <span className="text-gradient">Get a 3D print.</span>
          </h1>
          <p className="text-[var(--color-muted)] text-base sm:text-lg max-w-lg mx-auto">
            Free, open-source photo-to-STL conversion. Upload a picture, get a 3D-printable model in minutes.
          </p>
        </div>

        {/* Upload */}
        <UploadZone onUpload={handleUpload} />

        {/* Stats footer */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-[var(--color-muted-2)] font-mono">
          <span>~3 min generation</span>
          <span className="hidden sm:inline opacity-30">|</span>
          <span>350K+ vertices</span>
          <span className="hidden sm:inline opacity-30">|</span>
          <span>Print-ready STL</span>
          {queueDepth !== null && (
            <>
              <span className="hidden sm:inline opacity-30">|</span>
              <span>{queueDepth} in queue</span>
            </>
          )}
        </div>
      </div>

      <footer className="py-6 text-center border-t border-[var(--color-border)] space-y-1">
        <p className="text-xs text-[var(--color-muted-2)]">20 free uploads per day per IP</p>
        <p className="text-xs text-[var(--color-muted-2)] italic">Free forever, or until the electricity bill gets weird.</p>
        <a
          href="https://github.com/ThatButters/3Dify"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[var(--color-muted-2)] hover:text-[var(--color-accent)] font-mono transition-colors"
        >
          GitHub — ThatButters/3Dify
        </a>
      </footer>
    </div>
  );
}
