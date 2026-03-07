# CLAUDE.md — Philippine Monitor (Bantay Pilipinas)

> AI-assisted development guide for the Philippine Monitor project.
> Forked from [koala73/worldmonitor](https://github.com/koala73/worldmonitor) (AGPL-3.0).

---

## Project Identity

**Name:** Philippine Monitor / Bantay Pilipinas
**Variant ID:** `philippine`
**Domain:** philippinemonitor.app (planned)
**Purpose:** Real-time Philippine-focused intelligence dashboard — geopolitical monitoring, maritime domain awareness (West Philippine Sea), disaster tracking, economic intelligence, and local news aggregation.
**Fork Source:** World Monitor v2.x (AGPL-3.0, Copyright Elie Habib 2024-2026)

---

## Quick Reference

```bash
# Development
npm run dev               # Frontend (Vite dev server, port 5173)
npm run dev:server        # Backend (Railway-style Node.js server, port 3001)
npm run dev:all           # Frontend + backend concurrently

# Build
npm run build             # Frontend production build (Netlify deploy)
npm run build:server      # Backend production build (Railway deploy)
npm run typecheck         # TypeScript strict check

# Database
npm run db:migrate        # Run Neon PostgreSQL migrations
npm run db:seed           # Seed static data (WPS features, bases, feeds)

# Test
npm test                  # Unit + integration tests
```

**Frontend:** Vite + Vanilla TypeScript → deployed on **Netlify**
**Backend:** Node.js (Fastify) → deployed on **Railway**
**Database:** **Neon PostgreSQL** (serverless Postgres)
**Map Default Center:** `lat: 12.8797, lon: 121.7740, zoom: 6`

---

## Architecture Overview

This project is a single-variant fork of World Monitor, with a fundamentally different deployment architecture. Instead of Vercel Edge Functions (stateless, serverless), we use a **persistent Railway backend** with **Neon PostgreSQL** for data storage and a **Netlify** static frontend. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for full system design.

### Deployment Stack

| Layer | Service | Purpose |
|---|---|---|
| **Frontend** | Netlify | Static site hosting, CDN, build pipeline |
| **Backend** | Railway | Persistent Node.js server (Fastify), API endpoints, WebSocket, cron scrapers |
| **Database** | Neon PostgreSQL | Time-series data, news archive, vessel tracks, score history, feed config |

### Why This Stack (vs. World Monitor's Vercel Edge)

- **Railway persistent server** — PH government sites (PAGASA, PHIVOLCS, BSP) require scraping, session state, and cron scheduling. Edge functions can't do this reliably within 10-second execution limits.
- **Neon PostgreSQL** — enables historical WPS vessel tracks, earthquake catalogs, typhoon archives, RSI trend analysis, and news deduplication. World Monitor is entirely stateless — we're not.
- **Netlify** — clean separation of static frontend from API backend. Familiar deployment workflow, automatic branch previews, excellent build pipeline.

### Key Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| **Framework** | Vanilla TypeScript (inherited) | No framework overhead, sub-250KB bundle |
| **Map Engine** | deck.gl + MapLibre GL (primary), globe.gl (WPS context) | deck.gl for detailed PH layers; globe.gl for showing PH position relative to China/ASEAN |
| **Backend** | Fastify on Railway | Persistent process for scrapers, WebSocket, cron jobs |
| **Database** | Neon PostgreSQL | Serverless Postgres for time-series, history, feed config |
| **AI Pipeline** | Ollama → Groq → OpenRouter → Browser T5 | Same 4-tier fallback; prompts rewritten for PH context |
| **Caching** | In-memory (backend) + Postgres query cache + CDN (Netlify) | No separate Redis needed; Postgres handles persistence |
| **Data Scope** | Philippine EEZ + ASEAN buffer | All feeds, layers, scoring filtered to PH region |

### What Changed from Upstream

| Area | World Monitor | Philippine Monitor |
|---|---|---|
| **Variants** | 5 (World/Tech/Finance/Commodity/Happy) | 1 (Philippine) |
| **RSS Feeds** | 435+ global | ~80-100 Philippine-focused |
| **Map Layers** | 45 global layers | ~25 PH-specific layers |
| **CII Countries** | 20 Tier-1 nations | Regional Stability Index (NCR, BARMM, WPS, CAR, EV/Bicol) |
| **Hotspots** | 30+ global | ~15 Philippine (WPS features, insurgency zones, disaster corridors) |
| **Military Bases** | 220+ global | EDCA sites + AFP installations + detected foreign presence |
| **Scoring** | Global strategic risk | Philippine Stability Index + WPS Tension Score |
| **Languages** | 21 | 2 (English, Filipino) with Cebuano/Ilocano stretch |

---

## Project Structure

```
ph-monitor/
├── CLAUDE.md                          # This file — AI development guide
├── README.md                          # Public-facing project documentation
├── package.json                       # Root workspace config
├── .env.example                       # Environment variable template
│
├── frontend/                          # Netlify-deployed static frontend
│   ├── package.json                   # Frontend dependencies
│   ├── vite.config.ts                 # Build configuration
│   ├── tsconfig.json                  # TypeScript config
│   ├── index.html                     # Entry HTML
│   ├── netlify.toml                   # Netlify build + redirect config
│   ├── src/
│   │   ├── main.ts                    # Entry point
│   │   ├── App.ts                     # Main application orchestrator
│   │   ├── config/
│   │   │   ├── feeds.ts               # Philippine RSS feed definitions (mirrors DB)
│   │   │   ├── geo.ts                 # PH hotspots, WPS features, fault lines, volcanoes
│   │   │   ├── bases.ts               # EDCA sites + AFP installations
│   │   │   ├── infrastructure.ts      # Cables, power grid, ports
│   │   │   ├── markets.ts             # PSE symbols, BSP indicators
│   │   │   ├── entities.ts            # PH entity registry (companies, gov agencies, politicians)
│   │   │   ├── panels.ts             # Panel configs, layer defaults
│   │   │   └── regions.ts             # Island group definitions (Luzon/Visayas/Mindanao)
│   │   ├── services/                  # Client-side services (call backend API)
│   │   │   ├── api-client.ts          # HTTP client for Railway backend
│   │   │   ├── websocket.ts           # WebSocket client for AIS/real-time data
│   │   │   ├── clustering.ts          # Jaccard similarity clustering (client-side, Web Worker)
│   │   │   ├── correlation.ts         # Signal detection engine (PH-adapted)
│   │   │   ├── focal-point-detector.ts
│   │   │   ├── stability-index.ts     # Client-side RSI display logic
│   │   │   ├── activity-tracker.ts    # New item detection
│   │   │   └── data-freshness.ts      # Source staleness tracking
│   │   ├── components/                # UI panels and map
│   │   │   ├── DeckGLMap.ts           # deck.gl + MapLibre (primary map)
│   │   │   ├── GlobeMap.ts            # globe.gl (WPS geopolitical context)
│   │   │   ├── MapContainer.ts        # Map wrapper with engine switching
│   │   │   ├── SearchModal.ts         # ⌘K universal search
│   │   │   ├── NewsPanel.ts           # News feed with clustering
│   │   │   ├── WPSPanel.ts            # West Philippine Sea dedicated panel
│   │   │   ├── DisasterPanel.ts       # PAGASA/PHIVOLCS/NDRRMC unified panel
│   │   │   ├── MarketPanel.ts         # PSE + BSP economic panel
│   │   │   ├── OFWPanel.ts            # OFW/diaspora news and remittance data
│   │   │   ├── InsightsPanel.ts       # AI briefings + focal points
│   │   │   ├── StabilityPanel.ts      # Regional Stability Index display
│   │   │   ├── MilitaryPanel.ts       # EDCA, AFP, foreign presence
│   │   │   ├── InfrastructurePanel.ts # Power grid, internet, transport
│   │   │   └── VirtualList.ts         # Virtual scrolling (inherited)
│   │   ├── workers/
│   │   │   └── analysis.worker.ts     # Off-thread clustering & correlation
│   │   ├── utils/
│   │   │   ├── sanitize.ts            # XSS prevention (inherited)
│   │   │   └── urlState.ts            # Shareable link encoding
│   │   ├── types/
│   │   │   └── index.ts               # Shared TypeScript type definitions
│   │   └── styles/
│   │       └── main.css               # Styles
│   └── public/                        # Static assets (icons, favicon)
│
├── server/                            # Railway-deployed Node.js backend
│   ├── package.json                   # Backend dependencies (fastify, pg, node-cron)
│   ├── tsconfig.json                  # Backend TypeScript config
│   ├── src/
│   │   ├── index.ts                   # Server entry point (Fastify)
│   │   ├── routes/
│   │   │   ├── news.ts                # GET /api/news — aggregated RSS feeds
│   │   │   ├── wps.ts                 # GET /api/wps — vessel tracking, incidents
│   │   │   ├── disaster.ts            # GET /api/disaster — PAGASA, PHIVOLCS, NDRRMC
│   │   │   ├── market.ts              # GET /api/market — PSE, BSP, forex
│   │   │   ├── military.ts            # GET /api/military — flights, vessel classification
│   │   │   ├── risk-scores.ts         # GET /api/risk-scores — pre-computed RSI + WPS tension
│   │   │   ├── summarize.ts           # POST /api/summarize — AI summarization (Groq/OpenRouter)
│   │   │   └── health.ts              # GET /api/health — service status
│   │   ├── scrapers/                  # Cron-scheduled data collectors
│   │   │   ├── rss-aggregator.ts      # RSS feed fetcher (all PH feeds)
│   │   │   ├── pagasa-scraper.ts      # PAGASA typhoon + weather bulletins
│   │   │   ├── phivolcs-scraper.ts    # PHIVOLCS earthquake + volcano feeds
│   │   │   ├── bsp-scraper.ts         # BSP exchange rates + economic data
│   │   │   ├── acled-fetcher.ts       # ACLED protest/conflict events (PH filter)
│   │   │   ├── gdelt-fetcher.ts       # GDELT news events (PH filter)
│   │   │   └── scheduler.ts           # node-cron job definitions
│   │   ├── services/
│   │   │   ├── ais-websocket.ts       # AIS vessel stream (PH EEZ filter)
│   │   │   ├── opensky-client.ts      # OpenSky military aircraft (OAuth2)
│   │   │   ├── wingbits-client.ts     # Aircraft enrichment
│   │   │   ├── stability-scorer.ts    # RSI computation engine
│   │   │   ├── wps-tension-scorer.ts  # WPS Tension Score computation
│   │   │   ├── ai-summarizer.ts       # Groq/OpenRouter/Ollama chain
│   │   │   └── circuit-breaker.ts     # Fault tolerance (per external source)
│   │   ├── db/
│   │   │   ├── client.ts              # Neon PostgreSQL connection (pg or drizzle-orm)
│   │   │   ├── schema.ts              # Table definitions
│   │   │   └── migrations/            # SQL migration files
│   │   └── ws/
│   │       └── realtime.ts            # WebSocket server (AIS relay to frontend clients)
│   └── Dockerfile                     # Railway deployment (optional, Railway also supports nixpacks)
│
├── shared/                            # Shared types between frontend and backend
│   ├── types.ts                       # API response types, entity definitions
│   └── constants.ts                   # PH geographic constants, enums
│
├── docs/
│   ├── ARCHITECTURE.md                # System architecture (detailed)
│   ├── DATA_SOURCES.md                # All feeds, APIs, data layers
│   ├── ALGORITHMS.md                  # Scoring formulas, detection logic
│   ├── MAP_LAYERS.md                  # Philippine-specific map layer docs
│   ├── WPS_MONITORING.md              # West Philippine Sea tracking design
│   └── DATABASE.md                    # Neon PostgreSQL schema + migration guide
├── tests/
│   ├── feeds.test.ts                  # Feed configuration validation
│   ├── wps-geo.test.ts                # WPS GeoJSON and EEZ boundary tests
│   ├── stability-index.test.ts        # Scoring algorithm tests
│   └── ...
└── .planning/
    └── ROADMAP.md                     # Development roadmap
```

---

## Coding Conventions

### Inherited from World Monitor

- **No UI frameworks** — direct DOM manipulation, custom Panel/VirtualList classes
- **TypeScript strict mode** — avoid `any`, use interfaces for data structures
- **No comments policy** — self-documenting code through clear naming; comments only for non-obvious algorithms
- **Security first** — always `escapeHtml()` for external content, `sanitizeUrl()` for URLs
- **Circuit breakers** — every external API call wrapped with fault tolerance
- **Web Workers** — CPU-intensive operations (clustering, correlation) off main thread
- **No `innerHTML` with user data** — use DOM API or escaped rendering

### Philippine Monitor Additions

- **Filipino entity names** — use official Filipino names with English aliases (e.g., `Dagat Kanlurang Pilipinas` alias `West Philippine Sea`)
- **Region codes** — use PSA PSGC codes for province/city identification where applicable
- **Typhoon naming** — always include PAGASA local name alongside international name (e.g., "Typhoon Carina (Gaemi)")
- **Currency** — PHP as primary, USD as secondary for remittance/forex context
- **Timezone** — PHT (UTC+8) as default display timezone

---

## Data Layer Priority

### Tier 1 — Always Active (Core Intelligence)

| Layer | Source | Refresh |
|---|---|---|
| WPS Maritime Activity | AIS + custom tracking | Real-time (WebSocket) |
| Active Typhoons | PAGASA + JTWC | 30 min |
| Earthquake Activity | PHIVOLCS + USGS | 5 min |
| National News | RSS feeds (Tier 1-2 sources) | 3 min |
| PSE Market Data | PSE/Yahoo Finance | 1 min (market hours) |

### Tier 2 — Default On (Important Context)

| Layer | Source | Refresh |
|---|---|---|
| EDCA/AFP Bases | Static config | N/A |
| Volcanic Hazard Zones | PHIVOLCS | Daily |
| Internet Outages | Cloudflare Radar (PH filter) | 5 min |
| Protest/Unrest | ACLED + GDELT (PH filter) | Hourly |
| Submarine Cables | Static config | N/A |

### Tier 3 — Optional (Specialized)

| Layer | Source | Refresh |
|---|---|---|
| Foreign Military Presence | ADS-B + AIS | 5 min |
| Shipping Lane Traffic | AIS density | Real-time |
| Flood Hazard Zones | Project NOAH / NAMRIA | Static |
| Mining Sites | Static config | N/A |
| Power Grid Status | DOE (if API available) | 30 min |

---

## Philippine RSS Feed Tiers

### Tier 1 — Wire Services & Official Government

- **Philippine News Agency (PNA)** — official state news agency
- **DFA** — Department of Foreign Affairs releases
- **Malacañang** — Presidential Communications Office
- **AFP Public Affairs** — Armed Forces of the Philippines
- **BSP** — Bangko Sentral ng Pilipinas

### Tier 2 — Major National Outlets

- **Inquirer.net** — Philippine Daily Inquirer
- **Rappler** — Digital-native investigative outlet
- **PhilStar** — The Philippine Star
- **Manila Bulletin** — Oldest English-language broadsheet
- **GMA News Online** — GMA Network
- **ABS-CBN News** — ABS-CBN Corporation
- **CNN Philippines** — Local CNN franchise
- **BusinessWorld** — Business/financial daily
- **BusinessMirror** — Business/economic coverage

### Tier 3 — Specialist & Regional

- **Vera Files** — Fact-checking, investigative
- **PCIJ** — Philippine Center for Investigative Journalism
- **MindaNews** — Mindanao-focused coverage
- **SunStar** — Visayas/Mindanao regional chain
- **The Manila Times** — National broadsheet
- **Interaksyon** — TV5 digital platform

### Tier 4 — Aggregators & International Coverage

- **Google News Philippines** — Aggregated PH news
- **Reuters Philippines** — International wire (PH filter)
- **AP Philippines** — International wire (PH filter)
- **South China Morning Post** — PH/WPS coverage
- **The Diplomat** — PH/ASEAN geopolitics
- **Nikkei Asia** — PH economic coverage
- **Benar News** — Southeast Asia security

---

## Key Algorithms (Philippine-Specific)

### Philippine Regional Stability Index (RSI)

Replaces global CII. Five monitored regions:

```
RSI(region) = baseline_risk × 0.30 + unrest × 0.25 + security × 0.25 + information × 0.20

Regions:
  NCR (Metro Manila)     — baseline: 15, political pulse, protest activity
  BARMM                  — baseline: 40, peace process, insurgency
  WPS Zone               — baseline: 35, maritime incidents, foreign vessels
  Cordillera/CAR         — baseline: 25, NPA activity, mining conflicts
  Eastern Visayas/Bicol  — baseline: 20, disaster vulnerability
```

### WPS Tension Score

Dedicated scoring for West Philippine Sea activity:

```
WPS_Tension = vessel_intrusions × 0.35 + diplomatic_signals × 0.25 +
              military_activity × 0.25 + news_velocity × 0.15

Inputs:
  vessel_intrusions  — CCG/PAFMM vessel count in PH EEZ (AIS)
  diplomatic_signals — DFA protests, ASEAN statements, UN mentions
  military_activity  — PLAAF/PLAN + AFP/US Navy activity (ADS-B/AIS)
  news_velocity      — WPS-related news cluster velocity
```

### Typhoon Impact Scoring

```
Impact = wind_speed_factor × 0.30 + population_exposure × 0.30 +
         track_uncertainty × 0.20 + infrastructure_risk × 0.20

wind_speed_factor    — PAGASA signal number (1-5) normalized to 0-100
population_exposure  — estimated population in forecast cone
track_uncertainty    — cone width at 48h forecast
infrastructure_risk  — power grid / telecom vulnerability in path
```

---

## West Philippine Sea Feature Registry

Critical geographic features tracked as first-class entities:

| Feature | Filipino Name | Coordinates | Status |
|---|---|---|---|
| Scarborough Shoal | Bajo de Masinloc | 15.15°N, 117.76°E | Chinese-controlled since 2012 |
| Ayungin Shoal | Second Thomas Shoal | 9.75°N, 115.87°E | PH-garrisoned (BRP Sierra Madre) |
| Pag-asa Island | Thitu Island | 11.05°N, 114.28°E | PH-occupied, civilian settlement |
| Kalayaan Group | Spratly Islands | Various | Multiple claimants |
| Panganiban Reef | Mischief Reef | 9.90°N, 115.53°E | Chinese artificial island |
| Recto Bank | Reed Bank | 11.45°N, 116.85°E | PH EEZ, oil/gas potential |
| Panatag Shoal | Scarborough Shoal | 15.15°N, 117.76°E | Alias for Scarborough |

---

## Environment Variables

```bash
# === DATABASE (Required) ===
DATABASE_URL=              # Neon PostgreSQL connection string
                           # Format: postgresql://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require

# === BACKEND (Railway) ===
PORT=3001                  # Railway auto-assigns via $PORT
FRONTEND_URL=              # Netlify URL for CORS (e.g., https://philippinemonitor.app)
NODE_ENV=production

# === AI (at least one recommended) ===
OLLAMA_API_URL=            # Local LLM (free)
OLLAMA_MODEL=              # e.g., llama3.1:8b
GROQ_API_KEY=              # Groq cloud (free tier: 14,400 req/day)
OPENROUTER_API_KEY=        # OpenRouter fallback

# === Philippine Data Sources ===
ACLED_ACCESS_TOKEN=        # Protest/conflict data (PH filter)

# === Market Data ===
FINNHUB_API_KEY=           # PSE proxy (free tier)

# === Maritime/Military ===
AISSTREAM_API_KEY=         # AIS vessel data
OPENSKY_CLIENT_ID=         # Military aircraft tracking
OPENSKY_CLIENT_SECRET=     # OpenSky auth

# === Infrastructure ===
CLOUDFLARE_API_TOKEN=      # Internet outage data
NASA_FIRMS_API_KEY=        # Satellite fire detection

# === Frontend (.env for Vite) ===
VITE_API_URL=              # Railway backend URL (e.g., https://ph-monitor-api.up.railway.app)
VITE_WS_URL=               # Railway WebSocket URL (e.g., wss://ph-monitor-api.up.railway.app)
```

---

## Development Workflow

### Adding a New Philippine Data Source

1. Define the TypeScript interface in `shared/types.ts`
2. Create scraper in `server/src/scrapers/` with cron schedule
3. Create DB migration in `server/src/db/migrations/` if persistent storage needed
4. Create API route in `server/src/routes/` to serve data
5. Create client-side service in `frontend/src/services/` to consume API
6. Add to panel in `frontend/src/components/`
7. Add map layer if geospatial (in `frontend/src/config/geo.ts`)
8. Write tests

### Adding a New API Endpoint

1. Define route in `server/src/routes/{domain}.ts`
2. Register route in `server/src/index.ts`
3. If data needs persistence, create DB table + migration
4. If data comes from external source, create scraper with circuit breaker
5. Add corresponding client method in `frontend/src/services/api-client.ts`

### Local Development Setup

```bash
# Terminal 1: Backend
cd server
cp ../.env.example .env           # Fill in DATABASE_URL + API keys
npm install
npm run db:migrate
npm run dev                        # Fastify on http://localhost:3001

# Terminal 2: Frontend
cd frontend
npm install
npm run dev                        # Vite on http://localhost:5173
                                   # Proxies /api/* to localhost:3001
```

### Philippine-Specific Testing Checklist

- [ ] WPS features render correctly at zoom levels 4-10
- [ ] EEZ boundary is accurate (UNCLOS-defined)
- [ ] Typhoon tracks display with PAGASA signal numbers
- [ ] Filipino entity names resolve correctly in search
- [ ] PHT timezone displays correctly for all timestamps
- [ ] RSI scores compute correctly for all 5 regions
- [ ] Feed circuit breakers handle PH source downtime gracefully

---

## Upstream Sync Policy

This fork diverges significantly from upstream World Monitor. Sync strategy:

- **Cherry-pick** infrastructure improvements (caching, circuit breakers, virtual scrolling)
- **Skip** new global variants, global feed additions, global scoring changes
- **Evaluate** map engine upgrades, AI pipeline improvements, security patches
- **Never overwrite** PH-specific configs, feeds, scoring algorithms, or map layers

Maintain a `UPSTREAM_SYNC.md` log of cherry-picked commits.

---

## License

AGPL-3.0 (inherited from upstream). All modifications must be open-sourced under the same license. If deployed as a network service, source code must be available to users.

Copyright (C) 2024-2026 Elie Habib (original World Monitor)
Copyright (C) 2026 Jun / Sage Global Solutions (Philippine Monitor modifications)
