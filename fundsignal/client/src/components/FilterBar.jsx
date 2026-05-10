const ROUND_TYPES = ['All', 'Seed', 'Pre-Seed', 'Series A', 'Series B', 'Series C+'];
const TIME_RANGES = [
  { label: 'Last 24h', value: '1d' },
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 30 Days', value: '30d' },
  { label: 'Last 90 Days', value: '90d' },
];

function Pill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
        active
          ? 'bg-accent text-bg shadow-sm shadow-accent/30'
          : 'bg-surface text-gray-400 hover:text-white hover:bg-surface-light'
      }`}
    >
      {children}
    </button>
  );
}

export default function FilterBar({ filters, onChange, total }) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      {/* Round type pills */}
      <div className="flex flex-wrap gap-1.5">
        {ROUND_TYPES.map((rt) => (
          <Pill
            key={rt}
            active={filters.roundType === rt}
            onClick={() => onChange((f) => ({ ...f, roundType: rt }))}
          >
            {rt}
          </Pill>
        ))}
      </div>

      <div className="w-px h-5 bg-surface-light hidden lg:block" />

      {/* Time range pills */}
      <div className="flex gap-1.5">
        {TIME_RANGES.map(({ label, value }) => (
          <Pill
            key={value}
            active={filters.timeRange === value}
            onClick={() => onChange((f) => ({ ...f, timeRange: value }))}
          >
            {label}
          </Pill>
        ))}
      </div>

      {/* Search */}
      <div className="ml-auto relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Filter by company or keyword…"
          value={filters.search}
          onChange={(e) => onChange((f) => ({ ...f, search: e.target.value }))}
          className="bg-surface border border-surface-light rounded-lg pl-9 pr-4 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent/40 w-64 transition-colors"
        />
      </div>

      {total != null && (
        <span className="text-xs text-gray-500 shrink-0">{total} result{total !== 1 ? 's' : ''}</span>
      )}
    </div>
  );
}
