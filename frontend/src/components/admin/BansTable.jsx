import { useState } from 'react';

export default function BansTable({ bans, onRemove, onAdd }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newIp, setNewIp] = useState('');
  const [newReason, setNewReason] = useState('');
  const [newExpires, setNewExpires] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [removeLoading, setRemoveLoading] = useState(null);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newIp.trim()) return;
    setAddLoading(true);
    try {
      await onAdd(newIp.trim(), newReason.trim() || undefined, newExpires || undefined);
      setNewIp('');
      setNewReason('');
      setNewExpires('');
      setShowAdd(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setAddLoading(false);
    }
  };

  const handleRemove = async (id) => {
    setRemoveLoading(id);
    try {
      await onRemove(id);
    } finally {
      setRemoveLoading(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <span className="text-xs text-[var(--color-muted)] font-mono">{bans.length} active ban{bans.length !== 1 ? 's' : ''}</span>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20"
        >
          {showAdd ? 'Cancel' : '+ Add Ban'}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="px-4 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="IP or CIDR (e.g. 192.168.1.0/24)"
              value={newIp}
              onChange={(e) => setNewIp(e.target.value)}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[var(--color-accent)]"
              required
            />
            <input
              type="text"
              placeholder="Reason (optional)"
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[var(--color-accent)]"
            />
            <div className="flex gap-2">
              <input
                type="datetime-local"
                value={newExpires}
                onChange={(e) => setNewExpires(e.target.value)}
                className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[var(--color-accent)]"
              />
              <button
                type="submit"
                disabled={addLoading}
                className="px-4 py-2 rounded-xl text-xs font-medium btn-accent text-white disabled:opacity-50"
              >
                {addLoading ? '...' : 'Ban'}
              </button>
            </div>
          </div>
        </form>
      )}

      {bans.length === 0 ? (
        <p className="p-6 text-sm text-[var(--color-muted-2)]">No active bans</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] text-[var(--color-muted)] uppercase tracking-widest border-b border-[var(--color-border)]">
                <th className="pb-3 px-4 pt-3 font-medium">IP</th>
                <th className="pb-3 px-4 pt-3 font-medium">Reason</th>
                <th className="pb-3 px-4 pt-3 font-medium hidden md:table-cell">Expires</th>
                <th className="pb-3 px-4 pt-3 font-medium hidden md:table-cell">Created</th>
                <th className="pb-3 px-4 pt-3 font-medium w-8"></th>
              </tr>
            </thead>
            <tbody>
              {bans.map((ban) => (
                <tr key={ban.id} className="border-b border-[var(--color-border)]">
                  <td className="py-3 px-4 font-mono text-xs">{ban.ip}</td>
                  <td className="py-3 px-4 text-xs text-[var(--color-muted-2)]">{ban.reason || '—'}</td>
                  <td className="py-3 px-4 hidden md:table-cell text-[10px] text-[var(--color-muted-2)] font-mono">
                    {ban.expires_at ? new Date(ban.expires_at).toLocaleString() : 'Permanent'}
                  </td>
                  <td className="py-3 px-4 hidden md:table-cell text-[10px] text-[var(--color-muted-2)] font-mono">
                    {new Date(ban.created_at).toLocaleString()}
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => handleRemove(ban.id)}
                      disabled={removeLoading === ban.id}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-[var(--color-danger)]/10 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/20 disabled:opacity-50"
                    >
                      {removeLoading === ban.id ? '...' : 'Unban'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
