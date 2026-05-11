const ROUND_TYPES = ['All', 'Seed', 'Pre-Seed', 'Series A', 'Series B', 'Series C+'];
const TIME_RANGES = [
  { label: 'Last 24h', value: '1d' },
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 30 Days', value: '30d' },
];
const REGIONS = [
  'All Regions',
  'North America',
  'Europe',
  'Asia-Pacific',
  'Latin America',
  'Middle East & Africa',
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

      <div className="w-px h-5 bg-surface-light hidden lg:block" />

      {/* Region dropdown */}
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
        </svg>
        <select
          value={filters.region}
          onChange={(e) => onChange((f) => ({ ...f, region: e.target.value }))}
          className="appearance-none bg-surface border border-surface-light rounded-lg pl-8 pr-7 py-1.5 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors cursor-pointer"
        >
          {REGIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
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
