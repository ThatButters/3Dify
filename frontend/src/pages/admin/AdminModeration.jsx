import { useState, useEffect, useCallback } from 'react';
import { admin } from '../../api';
import ReportsTable from '../../components/admin/ReportsTable';
import BansTable from '../../components/admin/BansTable';

const TABS = ['reports', 'bans'];

export default function AdminModeration() {
  const [tab, setTab] = useState('reports');
  const [reportStatus, setReportStatus] = useState('pending');
  const [reports, setReports] = useState([]);
  const [bans, setBans] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const data = await admin.getReports(reportStatus);
      setReports(data.reports || data || []);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [reportStatus]);

  const fetchBans = useCallback(async () => {
    setLoading(true);
    try {
      const data = await admin.getBans();
      setBans(data.bans || data || []);
    } catch {
      setBans([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'reports') fetchReports();
    else fetchBans();
  }, [tab, fetchReports, fetchBans]);

  const handleDismiss = async (id) => {
    await admin.dismissReport(id);
    await fetchReports();
  };

  const handleRemoveJob = async (id) => {
    if (!window.confirm('Remove this job and its files? This cannot be undone.')) return;
    await admin.removeReportedJob(id);
    await fetchReports();
  };

  const handleAddBan = async (ip, reason, expires_at) => {
    await admin.addBan(ip, reason, expires_at);
    await fetchBans();
  };

  const handleRemoveBan = async (banId) => {
    await admin.removeBan(banId);
    await fetchBans();
  };

  return (
    <div className="max-w-6xl space-y-6">
      <h1 className="text-xl font-bold">Moderation</h1>

      {/* Tabs */}
      <div className="flex gap-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === t
                ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                : 'text-[var(--color-muted)] hover:text-white hover:bg-white/5'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Reports tab */}
      {tab === 'reports' && (
        <>
          <div className="flex gap-1">
            {['pending', 'dismissed', 'actioned'].map((s) => (
              <button
                key={s}
                onClick={() => setReportStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  reportStatus === s
                    ? 'bg-white/10 text-white'
                    : 'text-[var(--color-muted)] hover:text-white hover:bg-white/5'
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <div className="glass-strong rounded-2xl overflow-hidden">
            {loading ? (
              <p className="p-6 text-sm text-[var(--color-muted-2)]">Loading...</p>
            ) : (
              <ReportsTable reports={reports} onDismiss={handleDismiss} onRemove={handleRemoveJob} />
            )}
          </div>
        </>
      )}

      {/* Bans tab */}
      {tab === 'bans' && (
        <div className="glass-strong rounded-2xl overflow-hidden">
          {loading ? (
            <p className="p-6 text-sm text-[var(--color-muted-2)]">Loading...</p>
          ) : (
            <BansTable bans={bans} onRemove={handleRemoveBan} onAdd={handleAddBan} />
          )}
        </div>
      )}
    </div>
  );
}
