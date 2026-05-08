const STATUSES = ['New', 'Contacted', 'Replied', 'Passed'];

const STATUS_COLORS = {
  New:       'text-blue-400',
  Contacted: 'text-yellow-400',
  Replied:   'text-accent',
  Passed:    'text-gray-500',
};

export default function QueueTab({ queue, onUpdateQueue, showToast }) {
  const update = (queueId, patch) =>
    onUpdateQueue((prev) => prev.map((e) => (e.queueId === queueId ? { ...e, ...patch } : e)));

  const remove = (queueId) => {
    onUpdateQueue((prev) => prev.filter((e) => e.queueId !== queueId));
    showToast('Removed from queue', 'info');
  };

  const exportCSV = () => {
    const cols = ['Company', 'Round', 'Amount', 'Industry', 'Source', 'Status', 'Notes', 'Added'];
    const rows = queue.map((e) => [
      e.companyName,
      e.roundType,
      e.amount || '',
      e.industry || '',
      e.source || '',
      e.status,
      e.notes || '',
      new Date(e.addedAt).toLocaleDateString(),
    ]);
    const csv = [cols, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: `fundsignal-queue-${new Date().toISOString().slice(0, 10)}.csv`,
    });
    a.click();
    URL.revokeObjectURL(url);
    showToast('Queue exported to CSV', 'success');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold">Outreach Queue</h2>
          <p className="text-xs text-gray-500 mt-0.5">Saved in your browser. Export to CSV to back up.</p>
        </div>
        <button
          onClick={exportCSV}
          disabled={!queue.length}
          className="flex items-center gap-2 px-4 py-2 bg-surface border border-surface-light rounded-lg text-sm text-gray-300 hover:text-white hover:border-accent/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export CSV
        </button>
      </div>

      {!queue.length ? (
        <div className="bg-surface border border-surface-light rounded-xl flex flex-col items-center justify-center py-24 text-center">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-gray-400 text-sm max-w-xs">
            Your queue is empty. Add companies from the <span className="text-white font-medium">Dashboard</span> tab.
          </p>
        </div>
      ) : (
        <div className="bg-surface border border-surface-light rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-surface-light">
                  {['Company', 'Round', 'Amount', 'Status', 'Notes', ''].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {queue.map((entry) => (
                  <tr key={entry.queueId} className="border-b border-surface-light hover:bg-surface-light/30 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-white">{entry.companyName}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{entry.industry}</div>
                    </td>

                    <td className="px-4 py-3.5 text-gray-300 text-xs">{entry.roundType}</td>

                    <td className="px-4 py-3.5">
                      <span className={entry.amount ? 'text-accent font-semibold' : 'text-gray-600'}>
                        {entry.amount || '—'}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <select
                        value={entry.status}
                        onChange={(e) => update(entry.queueId, { status: e.target.value })}
                        className={`bg-surface-light border border-surface-light rounded px-2 py-1 text-xs focus:outline-none focus:border-accent/40 cursor-pointer ${STATUS_COLORS[entry.status] || 'text-white'}`}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>

                    <td className="px-4 py-3.5">
                      <input
                        type="text"
                        value={entry.notes}
                        onChange={(e) => update(entry.queueId, { notes: e.target.value })}
                        placeholder="Add notes…"
                        className="bg-transparent border-b border-surface-light focus:border-accent/50 text-xs text-gray-300 placeholder-gray-600 focus:outline-none w-48 py-0.5 transition-colors"
                      />
                    </td>

                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => remove(entry.queueId)}
                        title="Remove"
                        className="p-1 text-gray-600 hover:text-red-400 transition-colors rounded"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
