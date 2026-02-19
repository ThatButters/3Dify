import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import Header from './components/Header';
import Home from './pages/Home';
import JobPage from './pages/JobPage';
import Gallery from './pages/Gallery';
import QueuePage from './pages/QueuePage';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <div className="min-h-screen bg-[#0a0a0a] text-[#e5e5e5]">
          <Header />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/job/:jobId" element={<JobPage />} />
            <Route path="/gallery" element={<Gallery />} />
            <Route path="/queue" element={<QueuePage />} />
          </Routes>
        </div>
      </ToastProvider>
    </BrowserRouter>
  );
}
