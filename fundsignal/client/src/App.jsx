import { useState, useCallback, useEffect } from 'react';
import MetricsBar from './components/MetricsBar.jsx';
import ScanButton from './components/ScanButton.jsx';
import FilterBar from './components/FilterBar.jsx';
import ResultsTable from './components/ResultsTable.jsx';
import QueueTab from './components/QueueTab.jsx';
import Toast from './components/Toast.jsx';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function loadQueue() {
  try { return JSON.parse(localStorage.getItem('fundsignal_queue') || '[]'); }
  catch { return []; }
}

function sumCapital(results) {
  let totalM = 0;
  for (const r of results) {
    if (!r.amount) continue;
    const m = r.amount.match(/\$([\d.]+)(M|B)/);
    if (m) totalM += parseFloat(m[1]) * (m[2] === 'B' ? 1000 : 1);
  }
  if (!totalM) return null;
  return totalM >= 1000 ? `$${(totalM / 1000).toFixed(1)}B` : `$${Math.round(totalM)}M`;
}

function applyFilters(results, filters) {
  return results.filter((r) => {
    if (filters.roundType !== 'All') {
      // "Series C+" matches Series C, Series D, Series E, etc.
      if (filters.roundType === 'Series C+') {
        if (!['Series C', 'Series C+'].includes(r.roundType)) return false;
      } else if (r.roundType !== filters.roundType) {
        return false;
      }
    }
    if (filters.timeRange !== '7d' && r.publishedDate) {
      const ageDays = (Date.now() - new Date(r.publishedDate)) / 86400e3;
      if (filters.timeRange === '1d'  && ageDays > 1)  return false;
      if (filters.timeRange === '30d' && ageDays > 30) return false;
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const hay = `${r.companyName} ${r.title} ${r.snippet} ${r.industry}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [results, setResults] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [queryCount, setQueryCount] = useState(20);
  const [filters, setFilters] = useState({ roundType: 'All', timeRange: '7d', search: '' });
  const [queue, setQueue] = useState(loadQueue);

  useEffect(() => {
    localStorage.setItem('fundsignal_queue', JSON.stringify(queue));
  }, [queue]);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const handleScan = useCallback(async () => {
    setScanning(true);
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeRange: filters.timeRange }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setResults(data.results || []);
      setLastScan(new Date());
      if (data.queriesRun) setQueryCount(data.queriesRun);
      showToast(`${data.count} companies found`, 'success');
    } catch (err) {
      showToast(`Scan failed: ${err.message}`, 'error');
    } finally {
      setScanning(false);
    }
  }, [showToast]);

  const addToQueue = useCallback((company) => {
    if (queue.find((q) => q.url === company.url)) {
      showToast('Already in queue', 'warning');
      return;
    }
    const entry = {
      ...company,
      queueId: `q${Date.now()}`,
      status: 'New',
      notes: '',
      addedAt: new Date().toISOString(),
    };
    setQueue((q) => [...q, entry]);
    showToast(`${company.companyName} added to queue`, 'success');
  }, [queue, showToast]);

  const filtered = applyFilters(results, filters);
  const capital = sumCapital(results);

  return (
    <div className="min-h-screen bg-bg text-white font-sans">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="border-b border-surface-light px-6 py-4 flex items-center justify-between sticky top-0 bg-bg/90 backdrop-blur z-30">
        <div className="flex items-center gap-3">
          {/* Logo mark */}
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shadow-md shadow-accent/30">
            <svg className="w-4 h-4 text-bg" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
            </svg>
          </div>
          <span className="text-lg font-bold tracking-tight">FundedLead</span>
          <span className="hidden sm:inline text-xs text-gray-500 bg-surface border border-surface-light px-2.5 py-0.5 rounded-full">
            SDR Intelligence
          </span>
        </div>
        <ScanButton scanning={scanning} onScan={handleScan} queryCount={queryCount} />
      </header>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <nav className="border-b border-surface-light px-6 flex gap-6">
        {[
          { id: 'dashboard', label: 'Dashboard' },
          { id: 'queue', label: `Outreach Queue${queue.length ? ` (${queue.length})` : ''}` },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === id
                ? 'border-accent text-accent'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* ── Main ───────────────────────────────────────────────────────── */}
      <main className="px-6 py-6 max-w-screen-2xl mx-auto">
        {activeTab === 'dashboard' ? (
          <>
            <MetricsBar
              total={results.length}
              queued={queue.length}
              lastScan={lastScan}
            />
            <FilterBar filters={filters} onChange={setFilters} total={filtered.length} />
            <ResultsTable
              results={filtered}
              scanning={scanning}
              onAddToQueue={addToQueue}
              queue={queue}
            />
          </>
        ) : (
          <QueueTab queue={queue} onUpdateQueue={setQueue} showToast={showToast} />
        )}
      </main>

      {/* ── Toasts ─────────────────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2.5 z-50">
        {toasts.map((t) => (
          <Toast key={t.id} message={t.message} type={t.type} />
        ))}
      </div>
    </div>
  );
}
