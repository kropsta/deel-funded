require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();

app.use(cors());
app.use(express.json());

const SERPER_API_KEY = process.env.SERPER_API_KEY;
const SERPER_NEWS_URL   = 'https://google.serper.dev/news';
const SERPER_SEARCH_URL = 'https://google.serper.dev/search';

// Each query carries a roundHint used as fallback when the headline
// doesn't explicitly name the round type.
const QUERIES = [
  // Core funding language
  { q: '"raises funding round" OR "closes funding round" OR "secures funding"',              hint: null },
  { q: '"Series A funding" OR "Series B funding" OR "Series C funding" OR "seed round"',    hint: 'Seed' },
  { q: '"Series D funding" OR "Series E funding" OR "late-stage funding" OR "growth equity"', hint: 'Series C+' },
  { q: '"pre-seed funding" OR "pre-seed round" OR "seed stage funding" OR "seed investment"', hint: 'Pre-Seed' },
  { q: '"announces funding" OR "raises million" OR "raises billion" OR "oversubscribed round"', hint: null },

  // Verb variations journalists use
  { q: '"startup raises" OR "startup backed by" OR "startup secures" OR "startup lands"',   hint: null },
  { q: '"lands funding" OR "nets funding" OR "nabs funding" OR "bags funding" OR "pulls in funding"', hint: null },
  { q: '"raises seed" OR "raises Series A" OR "raises Series B" OR "raises Series C"',     hint: 'Seed' },
  { q: '"secures investment" OR "secures capital" OR "closes investment" OR "closes capital raise"', hint: null },
  { q: '"investment round" OR "financing round" OR "capital raise" OR "equity financing"',  hint: null },

  // Lead investor signals
  { q: '"led by" "venture" "raises" OR "backed by" "investors" "funding"',                 hint: null },
  { q: '"led by" "Capital" "million" OR "led by" "Ventures" "million" OR "led by" "Partners" "million"', hint: null },
  { q: '"backed by Sequoia" OR "backed by Andreessen" OR "backed by Y Combinator" OR "backed by General Catalyst"', hint: null },
  { q: '"backed by Accel" OR "backed by Tiger Global" OR "backed by Lightspeed" OR "backed by Bessemer"', hint: null },

  // Industry-vertical funding
  { q: '"AI startup" "raises" OR "AI company" "raises" OR "artificial intelligence" "funding round"', hint: null },
  { q: '"fintech" "raises" "million" OR "healthtech" "raises" "million" OR "SaaS" "raises" "million"', hint: null },
  { q: '"cleantech" "raises" OR "climate tech" "raises" OR "edtech" "raises" OR "proptech" "raises"', hint: null },
  { q: '"cybersecurity" "funding" OR "biotech" "funding round" OR "medtech" "raises" OR "insurtech" "raises"', hint: null },

  // Early-stage & stealth launches
  { q: '"exits stealth" "raises" OR "emerges from stealth" "funding" OR "launches with funding"', hint: 'Pre-Seed' },
  { q: '"venture capital investment" OR "venture-backed" "raises" OR "VC-backed" "funding round"', hint: null },

  // Regional — US cities
  { q: '"New York startup" "raises" OR "San Francisco startup" "raises" OR "Austin startup" "raises"', hint: null },
  { q: '"Boston startup" "raises" OR "Seattle startup" "raises" OR "Los Angeles startup" "raises"', hint: null },

  // Regional — international
  { q: '"UK startup" "raises" OR "London startup" "raises" OR "British startup" "funding"', hint: null },
  { q: '"European startup" "raises" OR "Berlin startup" "raises" OR "Paris startup" "raises"', hint: null },
  { q: '"India startup" "raises" OR "Singapore startup" "raises" OR "Australia startup" "raises" OR "Canada startup" "raises"', hint: null },
];

// ---------------------------------------------------------------------------
// Server-side content filter
// ---------------------------------------------------------------------------
const BLOCKLIST_DOMAINS = [
  'brisnet.com', 'bloodhorse.com', 'turfdiario', 'thoroughbreddailynews.com',
  'drf.com', 'equibase.com', 'paulickreport.com', 'horseracing.net',
  'racingpost.com', 'attheraces.com', 'timeform.com',
];

const BLOCKLIST_KEYWORDS = [
  'kentucky derby', 'preakness', 'belmont stakes', 'breeders cup',
  'horse racing', 'thoroughbred', 'racehorse', 'racetrack', 'aqueduct',
  'churchill downs', 'saratoga', 'santa anita', 'del mar',
  'jockey', 'trainer', 'handicapper', 'furlong', 'stallion', 'filly', 'gelding',
];

function isBlocked(item) {
  const domain = (item.link || '').toLowerCase();
  const text   = `${item.title} ${item.snippet || ''}`.toLowerCase();
  return (
    BLOCKLIST_DOMAINS.some((d)  => domain.includes(d)) ||
    BLOCKLIST_KEYWORDS.some((kw) => text.includes(kw))
  );
}

// Total query count exposed to the frontend for the loading message
const QUERY_COUNT = QUERIES.length;

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------
function parseDate(dateStr) {
  if (!dateStr) return null;
  const now = Date.now();
  const m = dateStr.match(/(\d+)\s+(minute|hour|day|week)/i);
  if (m) {
    const n  = parseInt(m[1]);
    const ms = { minute: 60e3, hour: 3600e3, day: 86400e3, week: 604800e3 }[m[2].toLowerCase()] || 0;
    return new Date(now - n * ms).toISOString();
  }
  const parsed = new Date(dateStr);
  return isNaN(parsed) ? null : parsed.toISOString();
}

function parseAmount(text) {
  const match = text.match(/\$\s*(\d+(?:\.\d+)?)\s*(billion|million|[BM])\b/i);
  if (!match) return null;
  const num  = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  return unit === 'billion' || unit === 'b' ? `$${num}B` : `$${num}M`;
}

function parseRoundType(text) {
  if (/pre-?seed/i.test(text))             return 'Pre-Seed';
  if (/series\s+[d-z]\b/i.test(text))     return 'Series C+';
  if (/series\s+c\b/i.test(text))         return 'Series C';
  if (/series\s+b\b/i.test(text))         return 'Series B';
  if (/series\s+a\b/i.test(text))         return 'Series A';
  if (/angel\s+(round|invest)/i.test(text)) return 'Angel';
  if (/bridge\s+(round|fund)/i.test(text)) return 'Bridge';
  if (/growth\s+(round|fund)/i.test(text)) return 'Growth';
  if (/seed\s+(round|fund|invest)/i.test(text)) return 'Seed';
  if (/\bseed\b/i.test(text))             return 'Seed';
  return 'Unknown';
}

function parseIndustry(text) {
  const checks = [
    ['AI/ML',         /\bai\b|artificial intelligence|machine learning|generative ai|llm\b/i],
    ['FinTech',       /fintech|financial tech|payment|neobank|crypto|blockchain|defi|insurtech/i],
    ['HealthTech',    /health(?:tech| tech)|medical|biotech|pharma|clinical|therapeut|medtech/i],
    ['Cybersecurity', /cyber(?:security| security)|infosec|zero.?trust|threat detect/i],
    ['CleanTech',     /clean(?:tech| energy)|renewable|sustainability|climate|green tech|carbon/i],
    ['EdTech',        /edtech|ed tech|education tech|e.?learning|learning platform/i],
    ['PropTech',      /proptech|real estate tech|property tech/i],
    ['Logistics',     /logistics|supply chain|shipping|freight|delivery|fulfillment/i],
    ['E-commerce',    /e.?commerce|retail tech|marketplace|d2c|direct.to.consumer/i],
    ['SaaS',          /\bsaas\b|software.as.a|enterprise software|b2b software|cloud platform/i],
  ];
  for (const [industry, re] of checks) {
    if (re.test(text)) return industry;
  }
  return 'Technology';
}

function parseCompanyName(title) {
  const match = title.match(/^(.+?)\s+(?:raises?|secures?|closes?|announces?|lands?|gets?|completes?|receives?)\s/i);
  if (match) {
    let name = match[1].trim().replace(/^(the|a|an)\s+/i, '');
    if (name.length > 60) name = name.split(/[,;]/)[0].trim();
    return name;
  }
  return title.split(/\s+/).slice(0, 4).join(' ');
}

function parseResult(item, id) {
  const text         = `${item.title} ${item.snippet || ''}`;
  const detectedRound = parseRoundType(text);
  const roundType    = detectedRound !== 'Unknown' ? detectedRound : (item._hint || 'Unknown');
  return {
    id,
    companyName:   parseCompanyName(item.title),
    title:         item.title,
    snippet:       item.snippet || '',
    amount:        parseAmount(text),
    roundType,
    industry:      parseIndustry(text),
    source:        item.source || 'Unknown',
    publishedDate: parseDate(item.date),
    rawDate:       item.date || null,
    url:           item.link,
    linkedInUrl:   null, // filled in after scan
  };
}

// ---------------------------------------------------------------------------
// LinkedIn lookup — uses Serper web search (not news)
// ---------------------------------------------------------------------------
async function findLinkedIn(companyName) {
  try {
    const res = await axios.post(
      SERPER_SEARCH_URL,
      { q: `"${companyName}" site:linkedin.com/company`, num: 3 },
      {
        headers: { 'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json' },
        timeout: 6000,
      }
    );
    for (const r of (res.data.organic || [])) {
      if (r.link && r.link.includes('linkedin.com/company/')) {
        return r.link.split('?')[0];
      }
    }
  } catch {
    // best-effort, silently skip
  }
  return null;
}

// ---------------------------------------------------------------------------
// Query runner
// ---------------------------------------------------------------------------
const TBS_MAP = { '1d': 'qdr:d', '7d': 'qdr:w', '30d': 'qdr:m' };

async function runQuery({ q, hint }, tbs = 'qdr:w') {
  const res = await axios.post(
    SERPER_NEWS_URL,
    { q, tbs, num: 10 },
    {
      headers: { 'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json' },
      timeout: 12000,
    }
  );
  if (!res.data.news) {
    console.error('Serper news missing:', JSON.stringify(res.data).slice(0, 200));
  }
  return (res.data.news || []).map((item) => ({ ...item, _hint: hint }));
}

// ---------------------------------------------------------------------------
// POST /api/scan
// ---------------------------------------------------------------------------
app.post('/api/scan', async (req, res) => {
  if (!SERPER_API_KEY) {
    return res.status(500).json({ error: 'SERPER_API_KEY is not configured on the server.' });
  }

  const { timeRange = '7d' } = req.body || {};
  const tbs = TBS_MAP[timeRange] || 'qdr:w';

  try {
    // 1. Run all news queries concurrently
    const settled = await Promise.allSettled(QUERIES.map((q) => runQuery(q, tbs)));
    const allItems = [];
    let failCount = 0;
    settled.forEach((r, i) => {
      if (r.status === 'fulfilled') allItems.push(...r.value);
      else { failCount++; console.error(`Query ${i} failed:`, r.reason?.message); }
    });
    console.log(`Queries: ${settled.length - failCount} ok, ${failCount} failed. Raw items: ${allItems.length}`);

    // 2. Deduplicate — prefer the copy that carries a roundHint
    const itemMap = new Map();
    for (const item of allItems) {
      if (isBlocked(item)) continue;
      const existing = itemMap.get(item.link);
      if (!existing) {
        itemMap.set(item.link, item);
      } else if (!existing._hint && item._hint) {
        itemMap.set(item.link, item);
      }
    }

    // 3. Parse results
    const unique = [];
    let counter = 0;
    for (const item of itemMap.values()) {
      unique.push(parseResult(item, `r${counter++}`));
    }

    // 4. Sort newest first
    unique.sort((a, b) => {
      if (!a.publishedDate && !b.publishedDate) return 0;
      if (!a.publishedDate) return 1;
      if (!b.publishedDate) return -1;
      return new Date(b.publishedDate) - new Date(a.publishedDate);
    });

    // 5. LinkedIn lookup — prioritise results with a known amount (more actionable),
    //    cap at 20 lookups to keep API credit usage and latency reasonable
    const withAmount    = unique.filter((r) => r.amount);
    const withoutAmount = unique.filter((r) => !r.amount);
    const toLookup      = [...withAmount, ...withoutAmount].slice(0, 20);

    const linkedInResults = await Promise.allSettled(
      toLookup.map((r) => findLinkedIn(r.companyName))
    );
    linkedInResults.forEach((result, i) => {
      if (result.status === 'fulfilled' && result.value) {
        toLookup[i].linkedInUrl = result.value;
      }
    });

    res.json({ results: unique, count: unique.length, queriesRun: QUERY_COUNT });
  } catch (err) {
    console.error('Scan error:', err.message);
    res.status(500).json({ error: 'Scan failed', details: err.message });
  }
});

// ---------------------------------------------------------------------------
// Queue routes (in-memory; localStorage is the primary persistence on client)
// ---------------------------------------------------------------------------
let queueStore = [];

app.get('/api/queue',     (_req, res) => res.json(queueStore));

app.post('/api/queue', (req, res) => {
  const entry = { ...req.body, id: `q${Date.now()}`, createdAt: new Date().toISOString() };
  queueStore.push(entry);
  res.status(201).json(entry);
});

app.patch('/api/queue/:id', (req, res) => {
  const idx = queueStore.findIndex((e) => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  queueStore[idx] = { ...queueStore[idx], ...req.body };
  res.json(queueStore[idx]);
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 3001;
if (require.main === module) {
  app.listen(PORT, () => console.log(`FundedLead server → http://localhost:${PORT}`));
}

module.exports = app;
