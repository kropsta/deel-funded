export default function MetricsBar({ total, capital, queued, lastScan }) {
  const formatTime = (d) =>
    d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never';

  const metrics = [
    { label: 'Rounds Found', value: total || '0', icon: '📡' },
    { label: 'In Outreach Queue', value: queued || '0', icon: '📋' },
    { label: 'Last Scan', value: formatTime(lastScan), icon: '🕐' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      {metrics.map(({ label, value, icon }) => (
        <div
          key={label}
          className="bg-surface border border-surface-light rounded-xl p-5 flex flex-col gap-1"
        >
          <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wider">
            <span>{icon}</span>
            {label}
          </div>
          <div className="text-2xl font-semibold text-white mt-1">{value}</div>
        </div>
      ))}
    </div>
  );
}
