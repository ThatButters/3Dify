export default function AuditTable({ entries }) {
  if (entries.length === 0) {
    return <p className="p-6 text-sm text-[var(--color-muted-2)]">No audit log entries</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] text-[var(--color-muted)] uppercase tracking-widest border-b border-[var(--color-border)]">
            <th className="pb-3 px-4 font-medium">Time</th>
            <th className="pb-3 px-4 font-medium">Action</th>
            <th className="pb-3 px-4 font-medium hidden md:table-cell">Actor</th>
            <th className="pb-3 px-4 font-medium hidden lg:table-cell">Target</th>
            <th className="pb-3 px-4 font-medium hidden lg:table-cell">Details</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b border-[var(--color-border)]">
              <td className="py-3 px-4 text-[10px] text-[var(--color-muted-2)] font-mono whitespace-nowrap">
                {new Date(entry.created_at).toLocaleString()}
              </td>
              <td className="py-3 px-4">
                <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider ${actionColor(entry.action)}`}>
                  {entry.action}
                </span>
              </td>
              <td className="py-3 px-4 hidden md:table-cell text-xs font-mono text-[var(--color-muted-2)]">
                {entry.actor_ip || entry.actor || '—'}
              </td>
              <td className="py-3 px-4 hidden lg:table-cell text-xs font-mono text-[var(--color-muted-2)]">
                {entry.target_id?.slice(0, 8) || '—'}
              </td>
              <td className="py-3 px-4 hidden lg:table-cell text-xs text-[var(--color-muted-2)] max-w-xs truncate">
                {entry.details || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function actionColor(action) {
  if (!action) return 'bg-[var(--color-muted)]/10 text-[var(--color-muted)]';
  const a = action.toLowerCase();
  if (a.includes('delete') || a.includes('ban') || a.includes('remove')) {
    return 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]';
  }
  if (a.includes('create') || a.includes('upload') || a.includes('complete')) {
    return 'bg-[var(--color-success)]/10 text-[var(--color-success)]';
  }
  if (a.includes('pause') || a.includes('cancel') || a.includes('fail')) {
    return 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]';
  }
  return 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]';
}
