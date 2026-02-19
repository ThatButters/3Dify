import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import Header from './components/Header';
import Home from './pages/Home';
import JobPage from './pages/JobPage';
import Gallery from './pages/Gallery';
import QueuePage from './pages/QueuePage';

// Admin
import AdminRoute from './components/admin/AdminRoute';
import AdminLayout from './components/admin/AdminLayout';
import AdminLogin from './pages/admin/AdminLogin';
import AdminOverview from './pages/admin/AdminOverview';
import AdminJobs from './pages/admin/AdminJobs';
import AdminModeration from './pages/admin/AdminModeration';
import AdminRateLimits from './pages/admin/AdminRateLimits';
import AdminAudit from './pages/admin/AdminAudit';

function PublicLayout() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e5e5e5]">
      <Header />
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          {/* Public routes */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/job/:jobId" element={<JobPage />} />
            <Route path="/gallery" element={<Gallery />} />
            <Route path="/queue" element={<QueuePage />} />
          </Route>

          {/* Admin login (no sidebar) */}
          <Route path="/admin/login" element={<AdminLogin />} />

          {/* Admin routes (with sidebar) */}
          <Route path="/admin" element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }>
            <Route index element={<AdminOverview />} />
            <Route path="jobs" element={<AdminJobs />} />
            <Route path="moderation" element={<AdminModeration />} />
            <Route path="rate-limits" element={<AdminRateLimits />} />
            <Route path="audit" element={<AdminAudit />} />
          </Route>
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
