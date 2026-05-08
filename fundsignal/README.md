# FundedLead — Funding Intelligence Dashboard

A real-time funding intelligence tool for SDRs. Scans 6 concurrent news queries via Serper API to surface companies that just announced funding rounds, then lets you queue them for outreach.

---

## Quick Start

### Step 1 — Get a Serper API Key (free)

1. Go to [serper.dev](https://serper.dev)
2. Click **Get Started Free**
3. Create an account (Google login works)
4. Your API key appears on the dashboard — copy it
5. Free tier includes **2,500 searches** (each scan uses 6)

---

### Step 2 — Clone & Install

```bash
git clone <your-repo-url>
cd fundsignal

# Install all dependencies (root + server + client)
npm run install:all
```

---

### Step 3 — Configure Environment

```bash
# In the /server directory, create a .env file:
cp .env.example server/.env
```

Open `server/.env` and replace `your_key_here` with your actual Serper API key:

```
SERPER_API_KEY=abc123yourkeyhere
PORT=3001
```

---

### Step 4 — Run Locally

```bash
npm run dev
```

This starts both:
- **Express server** on `http://localhost:3001`
- **React frontend** on `http://localhost:5173`

Open [http://localhost:5173](http://localhost:5173) and click **Scan for New Rounds**.

---

## Deploy to Vercel

### Step 1 — Push to GitHub

```bash
git add .
git commit -m "Add FundedLead"
git push origin main
```

### Step 2 — Connect to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repository
3. Set **Root Directory** to `fundsignal`
4. Vercel will auto-detect the `vercel.json` config

### Step 3 — Add Environment Variable

1. In Vercel project settings → **Environment Variables**
2. Add: `SERPER_API_KEY` = `your_actual_key`
3. Click **Save**

### Step 4 — Deploy

Click **Deploy**. Done. Your FundedLead app is live.

> **Note:** The Outreach Queue persists in `localStorage` on the browser. On Vercel, the server-side queue is ephemeral (resets on each deploy) — use the Export CSV button to back up your queue.

---

## Features

- **Live news scan** — 6 concurrent Serper queries scoped to last 7 days
- **Smart parsing** — extracts company name, funding amount, round type, industry
- **Deduplication** — merges results across queries by URL
- **Filter & search** — by round type, time range, or keyword
- **Outreach Queue** — track status (New / Contacted / Replied / Passed) with inline notes
- **Export to CSV** — one-click queue export
- **Dark UI** — clean, SDR-focused dashboard

---

## Project Structure

```
fundsignal/
├── client/                  # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── server/                  # Express backend
│   ├── index.js
│   └── package.json
├── vercel.json
├── .env.example
└── package.json
```
