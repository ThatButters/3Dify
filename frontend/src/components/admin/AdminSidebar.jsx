import { Link, useLocation } from 'react-router-dom';
import useAdminAuth from '../../hooks/useAdminAuth';

const NAV_ITEMS = [
  { to: '/admin', label: 'Overview', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4' },
  { to: '/admin/jobs', label: 'Jobs', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
  { to: '/admin/moderation', label: 'Moderation', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
  { to: '/admin/rate-limits', label: 'Rate Limits', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
  { to: '/admin/audit', label: 'Audit Log', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
];

export default function AdminSidebar() {
  const { pathname } = useLocation();
  const { logout } = useAdminAuth();

  return (
    <aside className="w-56 shrink-0 glass-strong flex flex-col h-screen sticky top-0" style={{ borderRight: '1px solid rgba(255,255,255,0.04)' }}>
      {/* Header */}
      <div className="px-5 py-5 border-b border-[var(--color-border)]">
        <Link to="/admin" className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md btn-accent flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">3D</span>
          </div>
          <span className="text-sm font-bold tracking-tight">3Dify Admin</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ to, label, icon }) => {
          const active = to === '/admin' ? pathname === '/admin' : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-[var(--color-accent)]/10 text-white'
                  : 'text-[var(--color-muted)] hover:text-white hover:bg-white/5'
              }`}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
              </svg>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-[var(--color-border)] space-y-3">
        <Link to="/" className="block text-xs text-[var(--color-muted-2)] hover:text-white transition-colors px-3">
          ← Back to site
        </Link>
        <button
          onClick={logout}
          className="w-full text-left px-3 py-2 rounded-lg text-sm text-[var(--color-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
