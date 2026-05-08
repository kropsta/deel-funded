export default function ScanButton({ scanning, onScan }) {
  return (
    <button
      onClick={onScan}
      disabled={scanning}
      className={`flex items-center gap-2.5 px-5 py-2.5 rounded-lg font-medium text-sm transition-all select-none ${
        scanning
          ? 'bg-accent/15 text-accent/70 cursor-not-allowed'
          : 'bg-accent text-bg hover:bg-accent/90 active:scale-95 shadow-lg shadow-accent/20'
      }`}
    >
      {scanning ? (
        <>
          <svg className="animate-spin w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Scanning 6 news sources…
        </>
      ) : (
        <>
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          Scan for New Rounds
        </>
      )}
    </button>
  );
}
