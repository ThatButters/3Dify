import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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

        {/* About */}
        <div className="mt-12 max-w-3xl mx-auto w-full">
          <div className="glass-strong rounded-2xl p-8 space-y-6">
            <h2 className="text-lg font-semibold text-center">What is this?</h2>
            <p className="text-sm text-[var(--color-muted)] leading-relaxed text-center max-w-xl mx-auto">
              3Dify turns photos into 3D-printable STL files using <a href="https://github.com/Tencent/Hunyuan3D-2" target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] hover:text-white transition-colors">Hunyuan3D 2.1</a>, an open-source AI model by Tencent. Upload a picture of anything — your dog, your face, a weird thing you found at the thrift store — and get back a high-detail mesh ready for your 3D printer.
            </p>
            <p className="text-sm text-[var(--color-muted)] leading-relaxed text-center max-w-xl mx-auto">
              Your upload gets beamed to a GPU sitting in a guy's living room. Literally. An RTX 5070 Ti
              running under a desk, next to a dog bed, doing its best. The server is a home PC on a
              residential internet connection. If you're wondering why there's no SLA — now you know.
            </p>
            <div className="grid sm:grid-cols-3 gap-4 text-center">
              <div className="p-4 rounded-xl bg-[var(--color-surface-2)]">
                <p className="text-2xl font-bold text-gradient mb-1">1.</p>
                <p className="text-sm text-[var(--color-muted)]">Upload a photo</p>
                <p className="text-xs text-[var(--color-muted-2)] mt-1">JPG, PNG, or WebP up to 20MB</p>
              </div>
              <div className="p-4 rounded-xl bg-[var(--color-surface-2)]">
                <p className="text-2xl font-bold text-gradient mb-1">2.</p>
                <p className="text-sm text-[var(--color-muted)]">AI generates a 3D model</p>
                <p className="text-xs text-[var(--color-muted-2)] mt-1">~3 minutes on a living room GPU</p>
              </div>
              <div className="p-4 rounded-xl bg-[var(--color-surface-2)]">
                <p className="text-2xl font-bold text-gradient mb-1">3.</p>
                <p className="text-sm text-[var(--color-muted)]">Download your STL</p>
                <p className="text-xs text-[var(--color-muted-2)] mt-1">Watertight, print-ready, 350K+ vertices</p>
              </div>
            </div>
            <p className="text-xs text-[var(--color-muted-2)] text-center italic">
              No accounts, no watermarks, no catch. Just a guy with a GPU and a questionable electricity bill.
            </p>
          </div>
        </div>

        {/* Tips */}
        <div className="mt-8 max-w-md mx-auto glass-strong rounded-2xl p-6">
          <h3 className="text-xs text-[var(--color-muted)] uppercase tracking-widest mb-3 font-medium text-center">
            Garbage in, garbage out
          </h3>
          <p className="text-sm text-[var(--color-muted)] text-center mb-4">
            The AI is clever, not psychic. Help it help you:
          </p>
          <ul className="space-y-2 text-sm text-[var(--color-muted)]">
            <li className="flex items-start gap-2">
              <span className="text-[var(--color-success)] mt-0.5">&#10003;</span>
              <span>One subject, front-facing, centered in frame</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--color-success)] mt-0.5">&#10003;</span>
              <span>Clean background (or we'll remove it for you)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--color-success)] mt-0.5">&#10003;</span>
              <span>Good lighting — no harsh shadows or silhouettes</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--color-warning)] mt-0.5">&#10007;</span>
              <span>Group photos, blurry shots, or artistic angles</span>
            </li>
          </ul>
          <p className="text-xs text-[var(--color-muted-2)] text-center mt-4 italic">
            Think "passport photo energy" — boring is beautiful here.
          </p>
        </div>

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

      <footer className="py-6 text-center border-t border-[var(--color-border)] space-y-2">
        <p className="text-xs text-[var(--color-muted-2)]">20 free uploads per day per IP</p>
        <p className="text-sm text-[var(--color-muted)] italic">Free forever, or until the electricity bill gets weird.</p>
        <div className="flex items-center justify-center gap-4 text-xs">
          <Link to="/terms" className="text-[var(--color-muted-2)] hover:text-[var(--color-accent)] transition-colors">
            Terms
          </Link>
          <Link to="/privacy" className="text-[var(--color-muted-2)] hover:text-[var(--color-accent)] transition-colors">
            Privacy
          </Link>
          <a
            href="https://github.com/ThatButters/3Dify"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-muted-2)] hover:text-[var(--color-accent)] font-mono transition-colors"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
