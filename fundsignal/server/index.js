require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();

app.use(cors());
app.use(express.json());

const SERPER_API_KEY = process.env.SERPER_API_KEY;
const SERPER_URL = 'https://google.serper.dev/news';

const QUERIES = [
  '"raises funding round" OR "closes funding round" OR "secures funding"',
  '"Series A funding" OR "Series B funding" OR "Series C funding" OR "seed round"',
  '"startup raises" OR "startup backed by" OR "venture capital investment"',
  '"pre-seed funding" OR "angel round" OR "bridge round" OR "growth round"',
  '"announces funding" OR "raises million" OR "raises billion" OR "oversubscribed round"',
  '"led by" "venture" "raises" OR "backed by" "investors" "funding"',
];

// Parse relative Serper dates ("3 hours ago", "2 days ago") into ISO strings
function parseDate(dateStr) {
  if (!dateStr) return null;
  const now = Date.now();
  const m = dateStr.match(/(\d+)\s+(minute|hour|day|week)/i);
  if (m) {
    const n = parseInt(m[1]);
    const unit = m[2].toLowerCase();
    const ms = { minute: 60e3, hour: 3600e3, day: 86400e3, week: 604800e3 }[unit] || 0;
    return new Date(now - n * ms).toISOString();
  }
  const parsed = new Date(dateStr);
  return isNaN(parsed) ? null : parsed.toISOString();
}

function parseAmount(text) {
  const match = text.match(/\$\s*(\d+(?:\.\d+)?)\s*(billion|million|[BM])\b/i);
  if (!match) return null;
  const num = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  return unit === 'billion' || unit === 'b' ? `$${num}B` : `$${num}M`;
}

function parseRoundType(text) {
  if (/pre-?seed/i.test(text)) return 'Pre-Seed';
  if (/series\s+[d-z]\b/i.test(text)) return 'Series C+';
  if (/series\s+c\b/i.test(text)) return 'Series C';
  if (/series\s+b\b/i.test(text)) return 'Series B';
  if (/series\s+a\b/i.test(text)) return 'Series A';
  if (/angel\s+(round|invest)/i.test(text)) return 'Angel';
  if (/bridge\s+(round|fund)/i.test(text)) return 'Bridge';
  if (/growth\s+(round|fund)/i.test(text)) return 'Growth';
  if (/seed\s+(round|fund|invest)/i.test(text)) return 'Seed';
  if (/\bseed\b/i.test(text)) return 'Seed';
  return 'Unknown';
}

function parseIndustry(text) {
  const checks = [
    ['AI/ML', /\bai\b|artificial intelligence|machine learning|generative ai|llm\b/i],
    ['FinTech', /fintech|financial tech|payment|neobank|crypto|blockchain|defi|insurtech/i],
    ['HealthTech', /health(?:tech| tech)|medical|biotech|pharma|clinical|therapeut|medtech/i],
    ['Cybersecurity', /cyber(?:security| security)|infosec|zero.?trust|threat detect/i],
    ['CleanTech', /clean(?:tech| energy)|renewable|sustainability|climate|green tech|carbon/i],
    ['EdTech', /edtech|ed tech|education tech|e.?learning|learning platform/i],
    ['PropTech', /proptech|real estate tech|property tech/i],
    ['Logistics', /logistics|supply chain|shipping|freight|delivery|fulfillment/i],
    ['E-commerce', /e.?commerce|retail tech|marketplace|d2c|direct.to.consumer/i],
    ['SaaS', /\bsaas\b|software.as.a|enterprise software|b2b software|cloud platform/i],
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
  const text = `${item.title} ${item.snippet || ''}`;
  return {
    id,
    companyName: parseCompanyName(item.title),
    title: item.title,
    snippet: item.snippet || '',
    amount: parseAmount(text),
    roundType: parseRoundType(text),
    industry: parseIndustry(text),
    source: item.source || 'Unknown',
    publishedDate: parseDate(item.date),
    rawDate: item.date || null,
    url: item.link,
  };
}

async function runQuery(query) {
  const res = await axios.post(
    SERPER_URL,
    { q: query, tbs: 'qdr:w', num: 10 },
    {
      headers: { 'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json' },
      timeout: 12000,
    }
  );
  return res.data.news || [];
}

// ---------------------------------------------------------------------------
// POST /api/scan
// ---------------------------------------------------------------------------
app.post('/api/scan', async (req, res) => {
  if (!SERPER_API_KEY) {
    return res.status(500).json({ error: 'SERPER_API_KEY is not configured on the server.' });
  }

  try {
    const settled = await Promise.allSettled(QUERIES.map(runQuery));

    const allItems = [];
    settled.forEach((r) => {
      if (r.status === 'fulfilled') allItems.push(...r.value);
    });

    // Deduplicate by URL
    const seen = new Set();
    const unique = [];
    let counter = 0;
    for (const item of allItems) {
      if (!seen.has(item.link)) {
        seen.add(item.link);
        unique.push(parseResult(item, `r${counter++}`));
      }
    }

    // Sort newest first
    unique.sort((a, b) => {
      if (!a.publishedDate && !b.publishedDate) return 0;
      if (!a.publishedDate) return 1;
      if (!b.publishedDate) return -1;
      return new Date(b.publishedDate) - new Date(a.publishedDate);
    });

    res.json({ results: unique, count: unique.length });
  } catch (err) {
    console.error('Scan error:', err.message);
    res.status(500).json({ error: 'Scan failed', details: err.message });
  }
});

// ---------------------------------------------------------------------------
// Queue routes (in-memory; localStorage is the primary persistence on client)
// ---------------------------------------------------------------------------
let queueStore = [];

app.get('/api/queue', (_req, res) => res.json(queueStore));

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
// Start (skipped when imported as a Vercel serverless function)
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 3001;
if (require.main === module) {
  app.listen(PORT, () => console.log(`FundedLead server → http://localhost:${PORT}`));
}

module.exports = app;
