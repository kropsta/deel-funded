const BADGE = {
  Seed:       'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  'Pre-Seed': 'bg-orange-500/15 text-orange-400 border-orange-500/25',
  'Series A': 'bg-blue-500/15   text-blue-400   border-blue-500/25',
  'Series B': 'bg-green-500/15  text-green-400  border-green-500/25',
  'Series C': 'bg-purple-500/15 text-purple-400 border-purple-500/25',
  'Series C+':'bg-purple-500/15 text-purple-400 border-purple-500/25',
  Angel:      'bg-pink-500/15   text-pink-400   border-pink-500/25',
  Bridge:     'bg-gray-500/15   text-gray-400   border-gray-500/25',
  Growth:     'bg-teal-500/15   text-teal-400   border-teal-500/25',
  Unknown:    'bg-gray-700/20   text-gray-500   border-gray-600/20',
};

function timeAgo(iso) {
  if (!iso) return '—';
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (isNaN(diff) || diff < 0) return '—';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function SkeletonRow() {
  return (
    <tr className="border-b border-surface-light">
      {[120, 80, 70, 90, 60, 100].map((w, i) => (
        <td key={i} className="px-4 py-4">
          <div
            className="h-3.5 rounded animate-shimmer"
            style={{ width: `${w}px` }}
          />
        </td>
      ))}
    </tr>
  );
}

function RoundBadge({ type }) {
  const cls = BADGE[type] || BADGE.Unknown;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {type}
    </span>
  );
}

export default function ResultsTable({ results, scanning, onAddToQueue, queue }) {
  const isQueued = (url) => queue.some((q) => q.url === url);

  const headers = ['Company', 'Round', 'Amount', 'Source', 'Published', 'Actions'];

  const tableShell = (body) => (
    <div className="bg-surface border border-surface-light rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-surface-light">
              {headers.map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{body}</tbody>
        </table>
      </div>
    </div>
  );

  if (scanning) {
    return tableShell([...Array(8)].map((_, i) => <SkeletonRow key={i} />));
  }

  if (!results.length) {
    return (
      <div className="bg-surface border border-surface-light rounded-xl flex flex-col items-center justify-center py-24 text-center">
        <div className="text-5xl mb-4">📡</div>
        <p className="text-gray-400 text-sm max-w-sm">
          No results yet. Click <span className="text-white font-medium">Scan for New Rounds</span> to pull
          the latest funding announcements.
        </p>
      </div>
    );
  }

  return tableShell(
    results.map((r) => (
      <tr
        key={r.id}
        className="border-b border-surface-light hover:bg-surface-light/40 transition-colors group"
      >
        {/* Company */}
        <td className="px-4 py-3.5">
          <div className="font-medium text-white leading-tight">{r.companyName}</div>
          <div className="text-xs text-gray-500 mt-0.5">{r.industry}</div>
        </td>

        {/* Round */}
        <td className="px-4 py-3.5">
          <RoundBadge type={r.roundType} />
        </td>

        {/* Amount */}
        <td className="px-4 py-3.5">
          <span className={r.amount ? 'text-accent font-semibold' : 'text-gray-600'}>
            {r.amount || '—'}
          </span>
        </td>

        {/* Source */}
        <td className="px-4 py-3.5 text-gray-400 text-xs">{r.source}</td>

        {/* Published */}
        <td className="px-4 py-3.5 text-gray-400 text-xs tabular-nums">{timeAgo(r.publishedDate)}</td>

        {/* Actions */}
        <td className="px-4 py-3.5">
          <div className="flex items-center gap-2">
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 text-gray-600 hover:text-white transition-colors rounded"
              title="Open article"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>

            <button
              onClick={() => onAddToQueue(r)}
              disabled={isQueued(r.url)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                isQueued(r.url)
                  ? 'text-accent/40 bg-accent/5 cursor-default'
                  : 'text-accent bg-accent/10 hover:bg-accent/20'
              }`}
            >
              {isQueued(r.url) ? '✓ Queued' : '+ Queue'}
            </button>
          </div>
        </td>
      </tr>
    ))
  );
}
