import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import UploadZone from '../components/UploadZone';
import WorkerStatusBadge from '../components/WorkerStatusBadge';
import { uploadImage, getQueueStatus } from '../api';

export default function Home() {
  const navigate = useNavigate();
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
    const result = await uploadImage(file);
    localStorage.setItem('lastJobId', result.job_id);
    navigate(`/job/${result.job_id}`);
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center px-4 page-enter">
      <div className="w-full max-w-lg space-y-8 text-center">
        {/* Hero */}
        <div className="space-y-3">
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight">3Dify</h1>
          <p className="text-lg text-gray-400">Drop a photo. Get a 3D print.</p>
        </div>

        {/* Status badges */}
        <div className="flex items-center justify-center gap-6">
          <WorkerStatusBadge />
          {queueDepth !== null && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="font-mono">{queueDepth}</span> in queue
            </div>
          )}
        </div>

        {/* Upload */}
        <UploadZone onUpload={handleUpload} />

        {/* Footer info */}
        <div className="space-y-2 text-xs text-gray-600">
          <p>20 free uploads per day per IP</p>
          <div className="flex items-center justify-center gap-4">
            <Link to="/gallery" className="hover:text-gray-400 transition-colors">Gallery</Link>
            <span>·</span>
            <a
              href="https://github.com/ThatButters/3Dify"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-400 transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
