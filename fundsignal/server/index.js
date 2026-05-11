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

// Each query carries a roundHint (fallback round classification) and
// a region tag (inherited by all results from that query).
const QUERIES = [
  // Core funding language — global
  { q: '"raises funding round" OR "closes funding round" OR "secures funding"',               hint: null,       region: null },
  { q: '"Series A funding" OR "Series B funding" OR "Series C funding" OR "seed round"',     hint: 'Seed',     region: null },
  { q: '"Series D funding" OR "Series E funding" OR "late-stage funding" OR "growth equity"', hint: 'Series C+', region: null },
  { q: '"pre-seed funding" OR "pre-seed round" OR "seed stage funding" OR "seed investment"', hint: 'Pre-Seed', region: null },
  { q: '"announces funding" OR "raises million" OR "raises billion" OR "oversubscribed round"', hint: null,     region: null },

  // Verb variations journalists use — global
  { q: '"startup raises" OR "startup backed by" OR "startup secures" OR "startup lands"',    hint: null, region: null },
  { q: '"lands funding" OR "nets funding" OR "nabs funding" OR "bags funding" OR "pulls in funding"', hint: null, region: null },
  { q: '"raises seed" OR "raises Series A" OR "raises Series B" OR "raises Series C"',      hint: 'Seed', region: null },
  { q: '"secures investment" OR "secures capital" OR "closes investment" OR "closes capital raise"', hint: null, region: null },
  { q: '"investment round" OR "financing round" OR "capital raise" OR "equity financing"',   hint: null, region: null },

  // Lead investor signals — global
  { q: '"led by" "venture" "raises" OR "backed by" "investors" "funding"',                  hint: null, region: null },
  { q: '"led by" "Capital" "million" OR "led by" "Ventures" "million" OR "led by" "Partners" "million"', hint: null, region: null },
  { q: '"backed by Sequoia" OR "backed by Andreessen" OR "backed by Y Combinator" OR "backed by General Catalyst"', hint: null, region: null },
  { q: '"backed by Accel" OR "backed by Tiger Global" OR "backed by Lightspeed" OR "backed by Bessemer"', hint: null, region: null },

  // Industry-vertical funding — global
  { q: '"AI startup" "raises" OR "AI company" "raises" OR "artificial intelligence" "funding round"', hint: null, region: null },
  { q: '"fintech" "raises" "million" OR "healthtech" "raises" "million" OR "SaaS" "raises" "million"', hint: null, region: null },
  { q: '"cleantech" "raises" OR "climate tech" "raises" OR "edtech" "raises" OR "proptech" "raises"', hint: null, region: null },
  { q: '"cybersecurity" "funding" OR "biotech" "funding round" OR "medtech" "raises" OR "insurtech" "raises"', hint: null, region: null },

  // Early-stage & stealth — global
  { q: '"exits stealth" "raises" OR "emerges from stealth" "funding" OR "launches with funding"', hint: 'Pre-Seed', region: null },
  { q: '"venture capital investment" OR "venture-backed" "raises" OR "VC-backed" "funding round"', hint: null, region: null },

  // Regional — North America
  { q: '"New York startup" "raises" OR "San Francisco startup" "raises" OR "Austin startup" "raises"', hint: null, region: 'North America' },
  { q: '"Boston startup" "raises" OR "Seattle startup" "raises" OR "Los Angeles startup" "raises" OR "Toronto startup" "raises"', hint: null, region: 'North America' },

  // Regional — Europe
  { q: '"UK startup" "raises" OR "London startup" "raises" OR "British startup" "funding"',  hint: null, region: 'Europe' },
  { q: '"European startup" "raises" OR "Berlin startup" "raises" OR "Paris startup" "raises" OR "Amsterdam startup" "raises"', hint: null, region: 'Europe' },

  // Regional — Asia-Pacific
  { q: '"India startup" "raises" OR "Singapore startup" "raises" OR "Australia startup" "raises"', hint: null, region: 'Asia-Pacific' },
  { q: '"Japan startup" "raises" OR "Korea startup" "raises" OR "Southeast Asia startup" "raises"', hint: null, region: 'Asia-Pacific' },

  // Regional — Latin America
  { q: '"Brazil startup" "raises" OR "Latin America startup" "raises" OR "Argentina startup" "raises" OR "Mexico startup" "raises"', hint: null, region: 'Latin America' },

  // Regional — Middle East & Africa
  { q: '"Tel Aviv startup" "raises" OR "Israel startup" "raises" OR "Dubai startup" "raises" OR "Africa startup" "raises"', hint: null, region: 'Middle East & Africa' },
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

// Region detection: query tag wins; falls back to city/country keyword matching.
function parseRegion(text, queryRegion) {
  if (queryRegion) return queryRegion;
  const t = text.toLowerCase();
  if (/new york|san francisco|silicon valley|\baustin\b|\bboston\b|\bseattle\b|los angeles|chicago|miami|\bdenver\b|\batlanta\b|toronto|vancouver|montreal|\bcanada\b|canadian|united states|\bus startup\b|north america/.test(t)) return 'North America';
  if (/\blondon\b|united kingdom|\buk startup\b|british startup|berlin|paris|amsterdam|stockholm|\bdublin\b|\bmadrid\b|\bmilan\b|\bzurich\b|helsinki|copenhagen|\boslo\b|\blisbon\b|\bwarsaw\b|\bbrussels\b|\bvienna\b|\btallinn\b|\beuropean startup\b/.test(t)) return 'Europe';
  if (/\bindia\b|bangalore|bengaluru|\bmumbai\b|\bdelhi\b|singapore|australia|sydney|melbourne|\btokyo\b|\bjapan\b|south korea|\bseoul\b|beijing|shanghai|hong kong|taiwan|jakarta|indonesia|kuala lumpur|malaysia|vietnam|philippines|southeast asia|\bapac\b/.test(t)) return 'Asia-Pacific';
  if (/\bbrazil\b|sao paulo|são paulo|\bargentina\b|buenos aires|colombia|\bchile\b|\bsantiago\b|\bperu\b|latin america|\blatam\b|mexico city/.test(t)) return 'Latin America';
  if (/tel aviv|\bisrael\b|israeli|\bdubai\b|\buae\b|abu dhabi|saudi|riyadh|\bcairo\b|\begypt\b|\blagos\b|nigeria|nairobi|\bkenya\b|johannesburg|south africa|istanbul|\bturkey\b|\bqatar\b|\bdoha\b|middle east|\bmena\b/.test(t)) return 'Middle East & Africa';
  return 'Global';
}

function parseResult(item, id) {
  const text          = `${item.title} ${item.snippet || ''}`;
  const detectedRound = parseRoundType(text);
  const roundType     = detectedRound !== 'Unknown' ? detectedRound : (item._hint || 'Unknown');
  return {
    id,
    companyName:   parseCompanyName(item.title),
    title:         item.title,
    snippet:       item.snippet || '',
    amount:        parseAmount(text),
    roundType,
    industry:      parseIndustry(text),
    region:        parseRegion(text, item._region),
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

async function runQuery({ q, hint, region }, tbs = 'qdr:w') {
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
  return (res.data.news || []).map((item) => ({ ...item, _hint: hint, _region: region }));
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

    // 2. Deduplicate — prefer the copy with a roundHint; also rescue a region
    //    tag from whichever copy has one when the winner lacks it.
    const itemMap = new Map();
    for (const item of allItems) {
      if (isBlocked(item)) continue;
      const existing = itemMap.get(item.link);
      if (!existing) {
        itemMap.set(item.link, item);
      } else if (!existing._hint && item._hint) {
        // New copy wins on round hint — but keep existing region if new lacks one
        itemMap.set(item.link, item._region ? item : { ...item, _region: existing._region });
      } else if (!existing._region && item._region) {
        // Existing keeps round-hint advantage; borrow the region tag
        itemMap.set(item.link, { ...existing, _region: item._region });
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
