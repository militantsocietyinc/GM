# Philippine Monitor — Architecture

Detailed system architecture for the Philippine Monitor (Bantay Pilipinas), a regional intelligence dashboard forked from [World Monitor](https://github.com/koala73/worldmonitor).

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Data Flow Architecture](#data-flow-architecture)
3. [Frontend Architecture](#frontend-architecture)
4. [Map Engine](#map-engine)
5. [Philippine Data Sources](#philippine-data-sources)
6. [News Aggregation Pipeline](#news-aggregation-pipeline)
7. [AI Intelligence Pipeline](#ai-intelligence-pipeline)
8. [Scoring Algorithms](#scoring-algorithms)
9. [West Philippine Sea Monitoring](#west-philippine-sea-monitoring)
10. [Disaster Monitoring System](#disaster-monitoring-system)
11. [Economic Intelligence](#economic-intelligence)
12. [Backend API Layer](#backend-api-layer-railway)
13. [Caching Strategy](#caching-strategy)
14. [Security Model](#security-model)
15. [Performance Architecture](#performance-architecture)
16. [Deployment Architecture](#deployment-architecture)
17. [Testing Strategy](#testing-strategy)
18. [Migration from World Monitor](#migration-from-world-monitor)

---

## System Overview

Philippine Monitor is a single-variant, region-focused intelligence dashboard built on World Monitor's vanilla TypeScript frontend, with a **fundamentally different backend architecture**. Instead of 60+ stateless Vercel Edge Functions, we use a persistent Railway backend with Neon PostgreSQL for data storage, cron-scheduled scrapers, and WebSocket support.

### Design Principles

**Regional depth over global breadth.** Every feature is calibrated for the Philippine context. A WPS vessel intrusion is more important than a global market correlation signal. PAGASA signal numbers matter more than NWS weather warnings.

**Philippine-first data sources.** Local government agencies (PAGASA, PHIVOLCS, NDRRMC, BSP, PSE) are Tier 1 sources. International feeds provide supplementary context, not primary intelligence.

**Maritime domain awareness as a first-class concern.** The West Philippine Sea is the defining geopolitical feature. Vessel tracking, EEZ boundary monitoring, and diplomatic incident tracking are core — not optional layers.

**Disaster resilience as infrastructure.** The Philippines averages 20 typhoons per year, sits on the Ring of Fire, and has active volcanoes. Disaster monitoring is not a "natural events" layer — it is a primary intelligence stream.

**Persistent data enables historical intelligence.** Unlike the stateless upstream project, we store time-series data in PostgreSQL — WPS vessel tracks, earthquake catalogs, typhoon archives, RSI score history. This enables trend analysis and historical context that a cache-only architecture cannot provide.

### Deployment Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                     Philippine Data Sources                          │
│  PAGASA │ PHIVOLCS │ PNA │ BSP │ AIS │ ADS-B │ RSS │ ACLED │ GDELT │
└───────────────────────────┬──────────────────────────────────────────┘
                            │
               ┌────────────▼─────────────┐
               │   Railway Backend        │
               │   (Fastify + Node.js)    │
               │                          │
               │  ┌─────────────────┐     │
               │  │ Cron Scrapers   │     │     ┌──────────────────┐
               │  │ (node-cron)     │─────┼────▶│ Neon PostgreSQL  │
               │  │ RSS, PAGASA,    │     │     │                  │
               │  │ PHIVOLCS, BSP,  │     │     │ • news_articles  │
               │  │ ACLED, GDELT    │     │     │ • vessel_tracks  │
               │  └─────────────────┘     │     │ • earthquakes    │
               │                          │     │ • typhoons       │
               │  ┌─────────────────┐     │     │ • rsi_scores     │
               │  │ REST API        │◀────┼─────│ • wps_incidents  │
               │  │ /api/news       │     │     │ • feed_config    │
               │  │ /api/wps        │     │     └──────────────────┘
               │  │ /api/disaster   │     │
               │  │ /api/market     │     │
               │  │ /api/risk-scores│     │
               │  │ /api/summarize  │     │
               │  └────────┬────────┘     │
               │           │              │
               │  ┌────────▼────────┐     │
               │  │ WebSocket Server│     │
               │  │ (AIS relay +    │     │
               │  │  real-time push)│     │
               │  └────────┬────────┘     │
               └───────────┼──────────────┘
                           │
              ┌────────────┼────────────┐
              │ HTTPS      │ WSS        │
              ▼            ▼            │
┌──────────────────────────────────────┐│
│   Netlify (Static Frontend)          ││
│                                      ││
│  ┌──────────────┐ ┌───────────────┐  ││
│  │ Vite Bundle  │ │ Web Worker    │  ││
│  │ (Vanilla TS) │ │ (clustering,  │  ││
│  │              │ │  correlation) │  ││
│  └──────┬───────┘ └───────┬───────┘  ││
│         │                 │          ││
│         └────────┬────────┘          ││
│                  ▼                   ││
│         ┌────────────────┐           ││
│         │ deck.gl Map +  │           ││
│         │ DOM Panels     │           ││
│         └────────────────┘           ││
└──────────────────────────────────────┘│
```

### Why This Stack vs. World Monitor's Vercel Edge

| Concern | Vercel Edge Functions (World Monitor) | Railway + Neon (Philippine Monitor) |
|---|---|---|
| **PH gov site scraping** | 10-sec execution limit, no session state | Persistent process, cron scheduling, retry logic |
| **Historical data** | None — Redis TTL expires, data lost | PostgreSQL stores everything: vessel tracks, quake catalog, score history |
| **WebSocket** | Separate Railway relay needed anyway | Built into main server — one service, one deployment |
| **Cold starts** | Every request may cold-start (~200ms) | Always-on process, sub-10ms response |
| **Cost at scale** | 60+ functions × invocation cost | Single Railway service ($5/mo hobby, $20/mo pro) |
| **Cron jobs** | External trigger needed (GitHub Actions, etc.) | node-cron built into server process |
| **Connection pooling** | Not possible (stateless) | Persistent DB connection pool via Neon |
| **AI summarization** | Separate edge function per provider | Single route, server-side provider chain with DB caching |

---

## Data Flow Architecture

### Inbound Data Streams

Data enters the system through three server-side pathways on Railway, all persisting to Neon PostgreSQL.

**1. Cron-Scheduled Scrapers (Railway Backend)**

Philippine news and government data sources are collected by cron jobs running inside the Railway process. This is fundamentally different from World Monitor's per-request edge functions — scrapers run on schedule regardless of client connections.

```
node-cron scheduler (Railway backend)
    │
    ├── Every 3 min: RSS Aggregator
    │   ├── Fetch ~80-100 PH RSS feeds (parallel, circuit breakers)
    │   ├── Deduplicate by URL hash
    │   └── INSERT INTO news_articles (Neon PostgreSQL)
    │
    ├── Every 30 min: PAGASA Scraper
    │   ├── Scrape typhoon bulletins + weather
    │   └── UPSERT INTO typhoons, weather_advisories
    │
    ├── Every 5 min: PHIVOLCS Scraper
    │   └── INSERT INTO earthquakes, UPDATE volcano_status
    │
    ├── Every 30 min: BSP Scraper
    │   └── INSERT INTO economic_data
    │
    ├── Every 1 hour: ACLED + GDELT Fetchers
    │   └── INSERT INTO conflict_events, gdelt_events
    │
    └── Every 10 min: Score Computation
        ├── Query all recent data
        ├── Compute RSI (5 regions) + WPS Tension
        └── INSERT INTO stability_scores, wps_tension_scores
```

**2. Real-Time WebSocket (AIS Maritime)**

Railway backend maintains a persistent WebSocket to AISStream and relays filtered data to browser clients.

```
AISStream.io (global AIS feed)
    │
    ▼
Railway Backend (WebSocket client)
    │ ├── Filter to PH EEZ bounding box
    │ ├── Classify vessels (CCG/PLAN/PH Navy/fishing/commercial)
    │ ├── Detect WPS intrusions → INSERT INTO wps_incidents
    │ └── Snapshot positions → INSERT INTO vessel_tracks (periodic)
    │
    ▼
Railway Backend (WebSocket server)
    │ └── Relay filtered positions to connected browsers (WSS)
    ▼
Frontend (Netlify) renders on map + updates WPS Panel
```

**3. Frontend REST API Consumption**

The Netlify frontend polls the Railway backend REST API. No direct external API calls from the browser — all data is pre-fetched, processed, and served from PostgreSQL.

```
Frontend (Netlify)              Railway Backend                  Neon PostgreSQL
    │                                │                                │
    ├── GET /api/news ──────────────▶├── SELECT FROM news_articles ──▶│
    ├── GET /api/wps ───────────────▶├── SELECT FROM vessel_tracks ──▶│
    ├── GET /api/disaster ──────────▶├── SELECT FROM typhoons... ────▶│
    ├── GET /api/risk-scores ───────▶├── SELECT FROM stability_scores▶│
    ├── POST /api/summarize ────────▶├── Check cache → Groq/OpenRouter│
    └── GET /api/health ────────────▶├── Query feed_status ──────────▶│
```

**4. Static Configuration Data**

Geographic data (WPS features, EDCA bases, fault lines, volcanic hazard zones, submarine cables) is bundled at build time in `frontend/src/config/`. This data changes infrequently and does not require runtime fetching.

### Outbound Data Flows

**Shareable URLs** encode map state (center, zoom, active layers, time range) for link sharing.

**Data Export** supports CSV and JSON export of current dashboard state for offline analysis.

### Database Schema (Neon PostgreSQL)

Core tables enabling persistent intelligence:

```sql
-- News articles from RSS scrapers
news_articles (id, url_hash, title, url, source, source_tier, category,
               published_at, fetched_at, entities JSONB, sentiment)

-- AIS vessel position snapshots
vessel_tracks (id, mmsi, name, classification, flag_state, lat, lon,
               heading, speed, in_eez, near_feature, recorded_at)

-- WPS incidents (intrusions, confrontations)
wps_incidents (id, type, location, lat, lon, description, severity,
               vessels JSONB, detected_at, resolved_at)

-- PAGASA typhoon data
typhoons (id, international_name, local_name, lat, lon, max_wind_kph,
          signal_areas JSONB, forecast_track JSONB, impact_score, updated_at)

-- PHIVOLCS earthquake bulletins
earthquakes (id, magnitude, depth_km, lat, lon, location_text,
             intensity, tsunami_advisory, source, occurred_at)

-- Volcano alert status
volcano_status (id, name, lat, lon, alert_level, observations TEXT[],
                last_bulletin_at)

-- Pre-computed stability scores (time-series)
stability_scores (id, region_id, score, components JSONB, boosts JSONB,
                  level, trend, computed_at)

-- WPS tension score (time-series)
wps_tension_scores (id, score, components JSONB, level, trend, computed_at)

-- Economic indicators
economic_data (id, indicator, value, currency, source, recorded_at)

-- Feed health tracking
feed_status (id, feed_url, feed_name, status, last_success_at,
             last_error, consecutive_failures, cooldown_until)

-- AI summary cache
ai_summaries (id, headlines_hash, provider, summary_text, focal_points JSONB,
              created_at, expires_at)
```

Time-series tables (`stability_scores`, `wps_tension_scores`, `vessel_tracks`) enable trend analysis, historical playback, and baseline deviation detection — capabilities that the stateless upstream project cannot support.

---

## Frontend Architecture

### No Framework — Vanilla TypeScript

Inherited from World Monitor. The entire UI is built with direct DOM manipulation, custom Panel and VirtualList classes. This keeps the bundle under 250KB gzipped and provides fine-grained control over rendering performance.

**Why this matters for PH deployment:** Philippine internet speeds vary significantly by region. A lightweight bundle ensures usability on mobile data connections in provinces, not just Metro Manila fiber.

### Panel System

Panels are the primary UI abstraction. Each panel is a self-contained module responsible for fetching its data, rendering its content, and managing its lifecycle.

```typescript
interface Panel {
  id: string;                    // e.g., 'wps', 'disaster', 'news'
  title: string;                 // Display name
  category: PanelCategory;       // 'intelligence' | 'news' | 'data' | 'reference'
  render(container: HTMLElement): void;
  refresh(): Promise<void>;
  destroy(): void;
}
```

**Philippine Monitor Panels:**

| Panel ID | Category | Purpose |
|---|---|---|
| `insights` | intelligence | AI-synthesized Philippine brief with focal points |
| `stability` | intelligence | Regional Stability Index (5 regions) |
| `wps` | intelligence | West Philippine Sea dedicated monitoring |
| `military` | intelligence | EDCA, AFP activity, foreign presence detection |
| `news-national` | news | National politics, governance, legislation |
| `news-wps` | news | WPS/maritime/DFA news cluster |
| `news-security` | news | Insurgency, BARMM, internal security |
| `news-ofw` | news | OFW, diaspora, remittance news |
| `news-asean` | news | Regional geopolitics, ASEAN, China relations |
| `disaster` | data | PAGASA typhoons + PHIVOLCS seismic + NDRRMC alerts |
| `market` | data | PSE index, BSP rates, peso forex, remittance flows |
| `infrastructure` | data | Power grid, internet, transport, cable status |
| `live-video` | reference | Philippine news live streams (GMA, ABS-CBN, PTV) |

Panels are draggable, collapsible, and their order persists in localStorage.

### Virtual Scrolling

Large lists (100+ news items) use the inherited VirtualList component:

- Fixed-height mode: renders only visible items + 3-item overscan buffer
- Element pooling: reuses DOM nodes rather than creating new ones
- Reduces DOM node count from thousands to ~30

### Search (⌘K / Ctrl+K)

Universal search across all data sources, with Philippine-specific result types:

- News articles (clustered headlines)
- WPS features (Scarborough, Ayungin, Pag-asa, etc.)
- Government agencies (DFA, AFP, PAGASA, BSP, etc.)
- Infrastructure (cables, power plants, ports)
- Provinces and cities (via PSGC codes)
- Military installations (EDCA sites, AFP bases)

---

## Map Engine

### Dual Engine Strategy

| Engine | Use Case | Technology |
|---|---|---|
| **deck.gl + MapLibre GL** | Primary view — detailed Philippine layers | WebGL-accelerated, 25+ layers |
| **globe.gl + Three.js** | Context view — PH position in Asia-Pacific | 3D globe showing China proximity, sea lanes |

**Default View (deck.gl):**
- Center: `12.8797°N, 121.7740°E` (geographic center of Philippines)
- Zoom: 6 (frames entire archipelago including Kalayaan Island Group)
- Base map: OpenStreetMap tiles via MapLibre GL

**Context View (globe.gl):**
- Used to show the broader WPS context — China's proximity, nine-dash line extent, ASEAN neighbors
- Accessible via toggle button, not the default view

### Map Layers — Philippine Configuration

**Geopolitical Layers**

| Layer ID | Data | Rendering |
|---|---|---|
| `eez-boundary` | PH 200nm EEZ polygon (UNCLOS) | GeoJSON polygon, dashed blue stroke |
| `wps-features` | Scarborough, Spratlys, etc. | Icon markers with status color coding |
| `nine-dash-line` | China's claimed boundary | GeoJSON line, dashed red (reference only) |
| `territorial-sea` | 12nm territorial waters | GeoJSON polygon, light blue fill |
| `baselines` | Archipelagic baselines (RA 9522) | GeoJSON line |

**Military & Security Layers**

| Layer ID | Data | Rendering |
|---|---|---|
| `edca-sites` | 5 EDCA-designated locations | Star markers with facility details |
| `afp-bases` | Major AFP installations | Military markers by branch |
| `foreign-vessels` | Detected CCG/PAFMM/PLAN vessels | Red vessel icons in EEZ |
| `military-flights` | ADS-B military aircraft (PH region) | Aircraft icons with trails |
| `insurgency-zones` | NPA, ASG known operational areas | Shaded polygons |

**Infrastructure Layers**

| Layer ID | Data | Rendering |
|---|---|---|
| `submarine-cables` | Cable landings (Nasugbu, La Union, Daet) | Path lines with landing markers |
| `power-grid` | Luzon/Visayas/Mindanao grid interconnections | Path lines with status color |
| `ports` | Major ports (Manila, Cebu, Subic, Davao, GenSan) | Port markers with traffic data |
| `airports` | Major airports with delay status | Airport markers |
| `internet-outages` | Cloudflare Radar (PH filter) | Heatmap overlay |

**Natural Hazard Layers**

| Layer ID | Data | Rendering |
|---|---|---|
| `typhoon-tracks` | Active storm paths with forecast cones | Path lines + cone polygons |
| `earthquakes` | PHIVOLCS + USGS (PH region) | Circle markers scaled by magnitude |
| `volcanoes` | Active volcanoes with alert levels | Triangle markers with alert color |
| `fault-lines` | Major fault systems (Valley, Philippine, Manila Trench) | Path lines |
| `flood-zones` | Project NOAH flood hazard areas | Polygon overlays |
| `storm-surge` | Coastal storm surge vulnerability | Polygon overlays |

**Regional Focus Presets**

| Preset | Center | Zoom | Purpose |
|---|---|---|---|
| **Philippines** | 12.88°N, 121.77°E | 6 | Full archipelago |
| **Metro Manila** | 14.60°N, 121.00°E | 11 | NCR political pulse |
| **West Philippine Sea** | 13.00°N, 117.00°E | 7 | WPS maritime monitoring |
| **Mindanao** | 7.50°N, 125.50°E | 8 | BARMM, insurgency |
| **Visayas** | 10.30°N, 123.90°E | 8 | Central Philippines |
| **Kalayaan Group** | 10.50°N, 115.00°E | 8 | Spratly Islands detail |
| **Benham Rise** | 16.00°N, 125.50°E | 7 | Philippine Rise / eastern seaboard |

### Layer Interaction Model

- **Click markers** — opens popup with full context (inherited pattern)
- **Hover markers** — shows tooltip summary
- **Layer toggles** — show/hide via panel header buttons
- **Clustering** — nearby markers group at low zoom, expand on zoom in
- **WPS vessel click** — shows vessel details, classification, track history

---

## Philippine Data Sources

### Government Agency Feeds

| Agency | Data Type | Integration Method | Refresh |
|---|---|---|---|
| **PAGASA** | Typhoon bulletins, weather forecasts, rainfall advisories | Web scraping + RSS (no official API) | 30 min |
| **PHIVOLCS** | Earthquake bulletins, volcano advisories | RSS feed + web scraping | 5 min |
| **NDRRMC** | Disaster situation reports, evacuation data | RSS + PDF parsing | 1 hour |
| **BSP** | Exchange rates, remittance data, monetary policy | API + web scraping | 30 min (rates), daily (remittance) |
| **PSE** | Stock market data (PSEi, sector indices) | Yahoo Finance proxy (PSE Edge as alternative) | 1 min (market hours) |
| **PNA** | Official government news | RSS feed | 5 min |
| **DFA** | Foreign affairs statements, WPS-related releases | RSS + web scraping | 15 min |
| **DOE** | Power grid status, energy advisories | Web scraping | 30 min |

### International Data Sources (PH-Filtered)

| Source | Data Type | Filter |
|---|---|---|
| **ACLED** | Protest/conflict events | Country = PH |
| **GDELT** | News-derived events | Geo-filtered to PH bounding box |
| **USGS** | Earthquakes | Bounding box: 4°N-21°N, 116°E-127°E |
| **NASA FIRMS** | Satellite fire detection | PH bounding box |
| **OpenSky** | Military aircraft ADS-B | PH FIR bounding box |
| **AISStream** | Vessel positions | PH EEZ bounding box |
| **Cloudflare Radar** | Internet outages | Country = PH |

### Data Source Reliability Matrix

| Source | Availability | Latency | Structured API | Fallback |
|---|---|---|---|---|
| PAGASA | Medium (website-dependent) | 15-30 min | No (scraping required) | JTWC for typhoons, OpenWeather for general |
| PHIVOLCS | High | 5-10 min | Partial (RSS) | USGS for earthquakes |
| BSP | High | Variable | Partial | FRED for macro indicators |
| PSE | Medium | Real-time (market hours) | Via Yahoo Finance | Finnhub backup |
| ACLED | High | Hourly | Yes (REST API) | GDELT as supplement |
| AISStream | High | Real-time | Yes (WebSocket) | None (unique data) |
| OpenSky | Medium (rate-limited) | 10-15 sec | Yes (REST + OAuth2) | None |

---

## News Aggregation Pipeline

### Feed Processing

```
~80-100 Philippine RSS feeds
    │
    ▼
Railway Backend (cron scraper, every 3 min)
    │ ├── Per-feed circuit breakers
    │ ├── Source tier classification (1-4)
    │ ├── Deduplication by URL hash
    │ └── INSERT INTO news_articles (Neon PostgreSQL)
    ▼
Frontend fetches GET /api/news from Railway
    │
    ▼
Web Worker processing (client-side):
    │ ├── Headline tokenization (English + Filipino stop words)
    │ ├── Jaccard similarity clustering (threshold: 0.5)
    │ ├── Entity extraction (PH entity registry)
    │ ├── Sentiment analysis (PH-aware keyword lists)
    │ ├── Velocity computation (sources/hour)
    │ └── Category assignment
    ▼
Clustered news distributed to panels by category
```

### Philippine Entity Registry

The entity registry is adapted for Philippine context. Entity types:

| Type | Count (est.) | Examples |
|---|---|---|
| `government_agency` | 50+ | DFA, AFP, PAGASA, BSP, DILG, DOJ, COA, Ombudsman |
| `politician` | 30+ | Current president, VP, Senate president, House speaker, key senators |
| `company` | 40+ | SM, Ayala, San Miguel, PLDT, Globe, BDO, BPI, Jollibee |
| `organization` | 20+ | ASEAN, UN, IMF, ADB, ICC, MILF, MNLF, CPP-NPA |
| `country` | 15+ | China, USA, Japan, South Korea, Australia, Vietnam, ASEAN members |
| `geographic` | 30+ | WPS features, major cities, provinces, island groups |
| `military` | 15+ | Western Command, Northern Luzon Command, EDCA sites |

Each entity has aliases in both English and Filipino for comprehensive matching.

### News Categories

| Category | Panel Target | Keywords / Heuristics |
|---|---|---|
| **National Politics** | `news-national` | Malacañang, Congress, Senate, legislation, election |
| **WPS / Maritime** | `news-wps` | West Philippine Sea, Scarborough, Ayungin, EEZ, DFA protest |
| **Security** | `news-security` | NPA, Abu Sayyaf, BARMM, martial law, AFP operations |
| **Disaster** | `disaster` | Typhoon, earthquake, volcanic, flood, PAGASA, PHIVOLCS |
| **Economy** | `market` | BSP, PSE, peso, inflation, GDP, remittance, OFW |
| **OFW / Diaspora** | `news-ofw` | OFW, OWWA, DMW, deployment, repatriation |
| **Infrastructure** | `infrastructure` | Power outage, internet, Build Build Build, DPWH, DOTr |
| **ASEAN / Regional** | `news-asean` | ASEAN, China relations, Quad, AUKUS, South China Sea |

### Filipino Language Handling

- **Stop words:** Filipino stop words list (ang, ng, sa, at, na, mga, ay, kung, para, etc.) added to tokenizer
- **Entity aliases:** Filipino names included (e.g., "Dagat Kanlurang Pilipinas" for WPS)
- **Mixed-language headlines:** Many PH outlets use Taglish (Tagalog-English mix); tokenizer handles both
- **Sentiment keywords:** Filipino negative/positive indicators added (e.g., "patay" [dead], "kapayapaan" [peace])

---

## AI Intelligence Pipeline

### Summarization Chain

Same 4-tier fallback as World Monitor, with Philippine-aware system prompts:

```
1. Ollama (local)     — Free, private, PH-aware system prompt
2. Groq (Llama 3.3)   — Fast cloud inference, 14,400 req/day free
3. OpenRouter          — Fallback when Groq rate-limited
4. Browser T5 (ONNX)   — Offline, always available
```

**Philippine System Prompt Template:**

```
You are a Philippine intelligence analyst producing a situation brief.
Focus areas: West Philippine Sea maritime activity, domestic security
(NPA/BARMM), disaster preparedness (typhoons/earthquakes/volcanoes),
economic indicators (BSP/PSE/remittances), and national governance.

Prioritize:
1. WPS incidents and Chinese vessel activity
2. Active typhoons or volcanic unrest
3. Security incidents (insurgency, terrorism)
4. Major political/economic developments
5. OFW welfare and diaspora issues

Use PAGASA local typhoon names alongside international names.
Reference Philippine geographic features by their Filipino names
where applicable.
```

### Focal Point Detection (Philippine Adaptation)

The focal point detector correlates Philippine news entities with map signals:

```
Example focal point output:

FOCAL POINTS:
- WEST PHILIPPINE SEA [CRITICAL]: 15 news mentions + 8 map signals
  (CCG vessels detected, AFP patrol flights, AIS density spike)
  KEY: "DFA files diplomatic protest over Scarborough..."
  SIGNALS: 5 CCG vessels in EEZ, 2 AFP patrol flights, AIS anomaly

- TAAL VOLCANO [ELEVATED]: 6 news mentions + 3 map signals
  (PHIVOLCS Alert Level 2, SO2 emissions elevated, earthquake swarm)
  KEY: "PHIVOLCS raises Taal alert level..."

- BARMM [WATCH]: 4 news mentions + 2 map signals
  (security incident report, AFP operations)
  KEY: "AFP neutralizes NPA cell in Maguindanao..."
```

### Headline Scoring (Philippine Priorities)

Score boosters adapted for Philippine context:

**High Priority:**
- WPS keywords: `west philippine sea`, `scarborough`, `ayungin`, `chinese vessel`, `coast guard`, `EEZ violation`
- Disaster keywords: `typhoon`, `earthquake`, `volcanic eruption`, `flood`, `landslide`, `tsunami warning`
- Security keywords: `NPA`, `Abu Sayyaf`, `martial law`, `AFP operations`, `BARMM`, `encounter`
- Political crisis: `impeach`, `coup`, `state of emergency`, `people power`

**Medium Priority:**
- Economic: `BSP rate`, `peso`, `inflation`, `PSE`, `remittance`
- Governance: `Malacañang`, `Congress`, `Senate`, `Supreme Court`
- Infrastructure: `power outage`, `internet down`, `cable cut`

**Demoted:**
- Entertainment: `MMFF`, `celebrity`, `showbiz`, `pageant`
- Sports: `PBA`, `UAAP`, `Gilas`, `boxing` (unless politically significant)

---

## Scoring Algorithms

### Philippine Regional Stability Index (RSI)

Replaces the global Country Instability Index (CII). Monitors five Philippine regions rather than 20 countries.

```
RSI(region) = (
    baseline_risk × 0.30 +
    unrest_score × 0.25 +
    security_score × 0.25 +
    information_score × 0.20
) + contextual_boosts

Score range: 0-100
```

**Region Definitions:**

| Region ID | Name | Baseline Risk | Rationale |
|---|---|---|---|
| `ncr` | Metro Manila / NCR | 15 | Political hub, protest-prone, stable overall |
| `barmm` | Bangsamoro (BARMM) | 40 | Active peace process, residual insurgency |
| `wps` | West Philippine Sea Zone | 35 | Ongoing maritime disputes, foreign incursions |
| `car` | Cordillera / CAR + NL | 25 | NPA presence, mining conflicts |
| `ev-bicol` | Eastern Visayas / Bicol | 20 | Typhoon corridor, high disaster vulnerability |

**Component Calculations:**

```
Unrest Score (0-100):
  base = min(50, protest_count × 10)    // Fewer protests in PH = higher weight each
  fatality_boost = min(30, fatalities × 8)
  severity_boost = min(20, high_severity × 12)
  unrest = min(100, base + fatality_boost + severity_boost)

Security Score (0-100):
  flight_score = min(40, military_flights × 5)
  vessel_score = min(30, naval_vessels × 6)
  incident_score = min(30, security_incidents × 10)
  security = min(100, flight_score + vessel_score + incident_score)

Information Score (0-100):
  base = min(40, news_count × 6)
  velocity_boost = min(40, velocity × 12)
  alert_boost = 20 if breaking_news else 0
  information = min(100, base + velocity_boost + alert_boost)
```

**Contextual Boosts (max +20):**

| Boost | Max Points | Trigger |
|---|---|---|
| Typhoon in region | 15 | Active typhoon with PAGASA Signal 2+ affecting region |
| Volcanic unrest | 10 | PHIVOLCS Alert Level 2+ for volcano in region |
| WPS incident | 10 | DFA diplomatic protest or verified vessel intrusion |
| Focal point | 8 | AI focal point detection on region |

### WPS Tension Score

Dedicated composite score for West Philippine Sea activity:

```
WPS_Tension = (
    vessel_intrusion_score × 0.35 +
    diplomatic_signal_score × 0.25 +
    military_activity_score × 0.25 +
    news_velocity_score × 0.15
)

Score range: 0-100
```

**Vessel Intrusion Score (0-100):**
```
ccg_count = Chinese Coast Guard vessels detected in PH EEZ
pafmm_count = Philippine Armed Forces Maritime Militia vessels detected
intrusion_score = min(100, (ccg_count × 15) + (pafmm_count × 10))

// Proximity multipliers:
// Within 12nm of PH-occupied feature: × 2.0
// Within EEZ but >12nm: × 1.0
// Scarborough Shoal zone: × 1.5 (high political sensitivity)
```

**Tension Levels:**

| Level | Score | Visual | Meaning |
|---|---|---|---|
| **Critical** | 81-100 | Red | Active confrontation or unprecedented buildup |
| **High** | 61-80 | Orange | Significant foreign presence, diplomatic protests |
| **Elevated** | 41-60 | Yellow | Above-normal activity, monitoring required |
| **Normal** | 21-40 | Gray | Baseline maritime activity |
| **Low** | 0-20 | Green | Unusually quiet period |

### Typhoon Impact Score

For active typhoons threatening the Philippines:

```
Impact = (
    wind_factor × 0.30 +
    population_exposure × 0.30 +
    track_uncertainty × 0.20 +
    infrastructure_vulnerability × 0.20
)

wind_factor:
  PAGASA Signal 1: 20
  PAGASA Signal 2: 40
  PAGASA Signal 3: 60
  PAGASA Signal 4: 80
  PAGASA Signal 5: 100

population_exposure:
  Estimated population within forecast cone at 48h
  Normalized: Metro Manila landfall = 100, rural path = 20-40

track_uncertainty:
  Based on forecast cone width at 48h
  Narrow cone (high confidence) = 20
  Wide cone (low confidence) = 80

infrastructure_vulnerability:
  Power grid exposure + telecom infrastructure + flood-prone areas in path
  Based on historical damage patterns per province
```

---

## West Philippine Sea Monitoring

### EEZ Boundary Definition

The Philippine EEZ is defined by UNCLOS as extending 200 nautical miles from the archipelagic baselines (RA 9522). The GeoJSON polygon is pre-computed and bundled in `src/config/geo.ts`.

```typescript
interface WPSFeature {
  id: string;                    // e.g., 'scarborough-shoal'
  name: string;                  // English name
  filipinoName: string;          // Filipino name
  coordinates: [number, number]; // [lat, lon]
  status: 'ph-occupied' | 'china-controlled' | 'disputed' | 'uninhabited';
  description: string;
  occupyingForce?: string;       // e.g., 'Philippine Marines', 'China CCG'
  keyFacts: string[];
}
```

### Vessel Classification in PH EEZ

Vessels detected within the EEZ are classified using MMSI analysis, vessel name matching, and behavioral patterns:

| Classification | MMSI Prefix | Indicators | Alert Level |
|---|---|---|---|
| **Chinese Coast Guard (CCG)** | 412-414 | CCG hull numbers, government vessel type | High |
| **PH Armed Forces Maritime Militia (PAFMM)** | 412-414 | Fishing vessel behavior + militia patterns | High |
| **PLAN (Chinese Navy)** | 412-414 | Military vessel type, known hull numbers | Critical |
| **Philippine Navy** | 548 | Known BRP vessels | Friendly |
| **Philippine Coast Guard** | 548 | PCG vessel patterns | Friendly |
| **US Navy** | 338-339 | USN vessel names, military type | Monitoring |
| **Fishing (Philippine)** | 548 | Small vessel, fishing areas | Normal |
| **Fishing (Foreign)** | Various | Non-PH flag in EEZ | Elevated |
| **Commercial** | Various | Cargo/tanker AIS types | Normal |

### WPS Incident Detection

Automated detection of potential WPS incidents:

1. **Vessel intrusion:** Non-PH military/government vessel enters EEZ → generates alert
2. **Vessel swarming:** 5+ vessels from same flag state within 10nm of PH-occupied feature → critical alert
3. **Water cannon / harassment:** Rapid course changes + proximity to PH vessel (behavioral inference from AIS) → elevated alert
4. **AIS dark ship:** Vessel stops transmitting within EEZ → monitoring alert
5. **Chokepoint blockade:** Unusual vessel density near Scarborough or Ayungin → elevated alert

### Diplomatic Signal Tracking

News-derived signals related to WPS diplomacy:

- DFA diplomatic protests (nota verbale)
- ASEAN Joint Statements mentioning South China Sea
- UN / ITLOS / PCA proceedings
- Bilateral meetings (PH-China, PH-US, PH-Japan on maritime issues)
- EDCA implementation announcements

---

## Disaster Monitoring System

### Multi-Source Integration

```
PAGASA ──┐
         ├──▶ Disaster Panel (unified view)
PHIVOLCS ─┤     │
         │     ├── Active typhoon tracker with PAGASA signal map
NDRRMC ──┤     ├── Earthquake feed with intensity/magnitude
         │     ├── Volcano alert levels with hazard zones
NASA ────┤     ├── Flood/landslide warnings
EONET    │     └── Fire/hotspot detection (VIIRS)
         │
USGS ────┘  (supplementary earthquake data)
```

### PAGASA Integration

PAGASA does not provide a formal REST API. Integration uses web scraping of their public bulletins and RSS feeds.

**Typhoon Tracking Data:**
- Storm name (PAGASA local + international)
- Current position (lat/lon)
- Maximum sustained winds (km/h)
- Movement (direction + speed)
- PAGASA signal numbers by province/municipality
- Forecast track (12h, 24h, 48h, 72h positions)
- Rainfall advisory

**Signal Number Mapping:**

| Signal | Wind Speed | Meaning | Map Rendering |
|---|---|---|---|
| Signal 1 | 30-60 km/h | Minimal damage expected | Yellow zone |
| Signal 2 | 61-120 km/h | Moderate to heavy damage | Orange zone |
| Signal 3 | 121-170 km/h | Heavy to very heavy damage | Red zone |
| Signal 4 | 171-220 km/h | Very heavy to widespread damage | Dark red zone |
| Signal 5 | >220 km/h | Catastrophic damage | Purple zone |

### PHIVOLCS Integration

**Earthquake Bulletins:**
- Origin time, epicenter coordinates, depth, magnitude
- Intensity reports by municipality (PHIVOLCS Earthquake Intensity Scale)
- Tsunami advisory status

**Volcano Monitoring:**

| Alert Level | Status | Map Color | Dashboard Action |
|---|---|---|---|
| 0 | Normal | Green | Display only |
| 1 | Abnormal (low unrest) | Yellow | Display + info |
| 2 | Increasing unrest | Orange | Elevated alert |
| 3 | Magmatic unrest (hazardous eruption possible) | Red | High alert + RSI boost |
| 4 | Hazardous eruption imminent | Dark red | Critical alert |
| 5 | Hazardous eruption in progress | Purple | Critical alert + notifications |

**Monitored Volcanoes (Active):**
Taal, Mayon, Pinatubo, Kanlaon, Bulusan, Hibok-Hibok, and 20+ others classified as active by PHIVOLCS.

---

## Economic Intelligence

### PSE Market Panel

| Data Point | Source | Refresh |
|---|---|---|
| PSEi Composite Index | Yahoo Finance / PSE Edge | 1 min (market hours: 9:30-15:30 PHT) |
| Sector Indices | Yahoo Finance | 1 min |
| Top Gainers/Losers | Yahoo Finance | 5 min |
| Foreign Net Buy/Sell | PSE reports | End of day |

### BSP Economic Panel

| Data Point | Source | Refresh |
|---|---|---|
| USD/PHP Exchange Rate | BSP / Yahoo Finance | 5 min |
| Inflation Rate | BSP | Monthly |
| OFW Remittances | BSP | Monthly |
| Interest Rate (overnight) | BSP | On policy change |
| Gross International Reserves | BSP | Monthly |

### OFW Remittance Tracking

This is a unique Philippine intelligence dimension. BSP publishes monthly remittance data by source country.

```typescript
interface RemittanceData {
  month: string;
  totalUSD: number;        // Total remittances in USD
  byCountry: {             // Top source countries
    country: string;
    amountUSD: number;
    changePercent: number;  // Month-over-month change
  }[];
  yearToDate: number;
  trend: 'rising' | 'stable' | 'falling';
}
```

---

## Backend API Layer (Railway)

### Server Framework

The backend uses **Fastify** (Node.js) for its low overhead, built-in schema validation, and plugin architecture. It runs as a single persistent process on Railway.

```typescript
// server/src/index.ts
import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: [process.env.FRONTEND_URL, 'http://localhost:5173'],
});
await app.register(websocket);

// Register route modules
await app.register(import('./routes/news'));
await app.register(import('./routes/wps'));
await app.register(import('./routes/disaster'));
await app.register(import('./routes/market'));
await app.register(import('./routes/military'));
await app.register(import('./routes/risk-scores'));
await app.register(import('./routes/summarize'));
await app.register(import('./routes/health'));

// Start cron scrapers
await import('./scrapers/scheduler');

await app.listen({ port: Number(process.env.PORT) || 3001, host: '0.0.0.0' });
```

### API Endpoint Inventory

| Endpoint | Method | Purpose | Data Source |
|---|---|---|---|
| `/api/news` | GET | Aggregated PH news articles | Postgres (news_articles) |
| `/api/news?category=wps` | GET | Category-filtered news | Postgres (filtered query) |
| `/api/wps` | GET | WPS vessel positions + incidents | Postgres (vessel_tracks, wps_incidents) |
| `/api/wps/tension` | GET | Current WPS Tension Score + history | Postgres (wps_tension_scores) |
| `/api/disaster` | GET | Typhoons + earthquakes + volcano status | Postgres (typhoons, earthquakes, volcano_status) |
| `/api/disaster/typhoons` | GET | Active typhoons with forecast tracks | Postgres (typhoons) |
| `/api/market` | GET | PSE + BSP + forex data | Postgres (economic_data) + live Yahoo Finance |
| `/api/military` | GET | Military flights + vessel classification | OpenSky (live) + Postgres cache |
| `/api/risk-scores` | GET | RSI (5 regions) + WPS Tension | Postgres (stability_scores) |
| `/api/risk-scores/history` | GET | Historical score time-series | Postgres (time range query) |
| `/api/summarize` | POST | AI-generated Philippine brief | Groq → OpenRouter → Postgres cache |
| `/api/health` | GET | Service status + data freshness | Postgres (feed_status) |
| `/ws` | WebSocket | Real-time AIS vessel relay | AISStream → filtered relay |

### CORS Configuration

```typescript
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,               // e.g., https://philippinemonitor.app
  'http://localhost:5173',                 // Vite dev server
  'http://localhost:3000',                 // Netlify dev
];
```

### Circuit Breakers (Server-Side)

Each external data source has an independent circuit breaker in the Railway backend:

| Source | Failure Threshold | Cooldown | Retry |
|---|---|---|---|
| PAGASA scraper | 3 failures | 10 min | Cron retries on next schedule |
| PHIVOLCS scraper | 3 failures | 5 min | Cron retries on next schedule |
| BSP scraper | 3 failures | 30 min | Cron retries on next schedule |
| ACLED API | 3 failures | 30 min | Cron retries on next schedule |
| AISStream WebSocket | Auto-reconnect | 30 sec backoff | Exponential (30s → 60s → 120s) |
| OpenSky API | 3 failures | 5 min | Per-request retry |
| Groq API | 3 failures | 5 min | Falls through to OpenRouter |
| OpenRouter API | 3 failures | 5 min | Falls through to Ollama |

Circuit breaker state is held in-memory (not Postgres) since it's per-process and should reset on deploy.

---

## Caching Strategy

### No Separate Redis — Postgres + In-Memory

Unlike World Monitor's 3-tier Redis cache, we use PostgreSQL as the persistence layer and in-memory caching on the Railway backend. This eliminates a separate service dependency while providing better capabilities.

```
Frontend Request
    │
    ▼
Railway Backend (Fastify)
    │
    ├── In-Memory Cache (Map/LRU)      ← Hot data: <60 sec TTL
    │   ├── Latest news articles (pre-serialized JSON)
    │   ├── Current RSI scores
    │   ├── Active typhoon data
    │   └── AI summary cache (by headline hash)
    │
    ├── Neon PostgreSQL                 ← Warm data: persistent
    │   ├── Full news archive
    │   ├── Score time-series (30-day retention)
    │   ├── Vessel track history (7-day retention)
    │   └── AI summary cache (24h TTL via expires_at)
    │
    └── Upstream External API           ← Cold: only via scrapers
        └── Never called per-request (scrapers pre-fetch on cron)
```

### Why This Works Without Redis

| Concern | Redis (World Monitor) | Postgres + In-Memory (PH Monitor) |
|---|---|---|
| **Hot cache** | Redis in-memory | Node.js `Map` / LRU cache (same process) |
| **Shared cache** | Redis shared across edge function instances | Single Railway process — no sharing needed |
| **Persistence** | Redis TTL expires, data lost | Postgres retains everything |
| **Query flexibility** | Key-value only | Full SQL (time ranges, aggregation, joins) |
| **Cost** | $0-10/mo (Upstash) | $0 (included in Neon free tier) |
| **Cache stampede** | Need explicit prevention | Single process — no stampede possible |

### In-Memory Cache Configuration

```typescript
// server/src/services/cache.ts
const cache = new Map<string, { data: any; expiresAt: number }>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCached(key: string, data: any, ttlMs: number): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}
```

### Cache TTLs by Data Type

| Data | In-Memory TTL | Postgres Retention | Rationale |
|---|---|---|---|
| News articles (API response) | 30 sec | Indefinite | Fast API response, full archive |
| RSI scores | 60 sec | 30 days | Near-real-time display, trend analysis |
| WPS Tension | 60 sec | 30 days | Same as RSI |
| Typhoon data | 60 sec | Per-season | Frequent updates during active storms |
| Earthquake bulletins | 30 sec | Indefinite | Seismic catalog is permanent record |
| PSE market data | 15 sec | 90 days | Market hours need near-real-time |
| AI summaries | 1 hour | 24 hours | Expensive to generate |
| Aircraft enrichment | 24 hours | 30 days | Aircraft details rarely change |
| Vessel positions | Not cached (real-time WebSocket) | 7 days | Streaming data, archive for track replay |

### Netlify CDN Caching (Frontend)

Static assets served by Netlify CDN with appropriate cache headers:

| Asset Type | Cache-Control | Notes |
|---|---|---|
| JS/CSS bundles | `max-age=31536000, immutable` | Content-hashed filenames |
| Map tiles | Service Worker CacheFirst (500-tile cap) | Offline map support |
| HTML | `no-cache` | Always fresh for SPA routing |
| API responses (proxied) | Not cached by Netlify | Backend controls freshness |

---

## Security Model

### Security Layers

| Layer | Mechanism |
|---|---|
| **CORS** | Railway backend allows only Netlify frontend origin + localhost |
| **API key isolation** | All keys in Railway environment variables, never exposed to browser |
| **Input sanitization** | Frontend: `escapeHtml()`, `sanitizeUrl()`, `escapeAttr()` |
| **SQL injection prevention** | Parameterized queries only (pg library / drizzle-orm) |
| **Rate limiting** | Fastify rate-limit plugin on AI and heavy endpoints |
| **HTTPS** | Railway provides automatic TLS; Netlify provides automatic TLS |
| **Database** | Neon enforces SSL (`sslmode=require`); connection string is secret |
| **WebSocket auth** | Optional token-based auth for WebSocket connections |
| **Bot protection** | Fastify middleware blocks non-browser user agents on API routes |

### Philippine-Specific Considerations

- **Government website scraping:** Railway's non-cloud IP ranges are less likely to be blocked than Vercel/AWS edge IPs.
- **No PII collection:** Dashboard is read-only. No user accounts, no personal data stored.
- **AGPL compliance:** Source code must be available if deployed as network service.
- **Database access:** Neon connection string contains credentials — stored only in Railway env vars, never committed to git.

---

## Performance Architecture

### Target Performance Profile

| Metric | Target | Rationale |
|---|---|---|
| Initial bundle | <300KB gzipped | PH mobile data accessibility |
| First meaningful paint | <3 seconds | 4G mobile connection |
| Time to interactive | <5 seconds | Allow for map tile loading |
| Memory usage | <200MB | Mid-range Android devices |
| Refresh cycle CPU | <100ms | Battery conservation on mobile |

### Optimizations

- **Web Worker** for clustering and correlation (off main thread)
- **Virtual scrolling** for 100+ item lists
- **Lazy loading** for panels below the fold
- **Adaptive polling** (SmartPollLoop) — reduces frequency when tab is hidden
- **Request deduplication** — concurrent requests for same data coalesced
- **Build-time tree shaking** — only PH variant code included

---

## Deployment Architecture

### Production

```
┌──────────────────────────────────┐
│ Netlify (Frontend)               │
│ ├── Static site (CDN-distributed)│
│ ├── Automatic HTTPS              │
│ ├── Branch deploy previews       │
│ └── /api/* proxied to Railway    │
└──────────────┬───────────────────┘
               │ HTTPS / WSS
┌──────────────▼───────────────────┐
│ Railway (Backend)                │
│ ├── Fastify server (always-on)   │
│ ├── REST API + WebSocket         │
│ ├── Cron scrapers (node-cron)    │
│ └── In-memory cache (LRU)        │
└──────────────┬───────────────────┘
               │ PostgreSQL (SSL)
┌──────────────▼───────────────────┐
│ Neon PostgreSQL (Database)       │
│ ├── Serverless Postgres          │
│ ├── Auto-scaling compute         │
│ └── Database branching (dev/prod)│
└──────────────────────────────────┘
```

### Netlify Configuration

```toml
# netlify.toml (in frontend/)
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/api/*"
  to = "https://ph-monitor-api.up.railway.app/api/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Local Development

```bash
# Terminal 1: Backend on :3001
cd server && npm run dev

# Terminal 2: Frontend on :5173 (Vite proxies /api to :3001)
cd frontend && npm run dev
```

### Cost Estimation

| Service | Free Tier | Notes |
|---|---|---|
| **Netlify** | 100 GB bandwidth/mo | Sufficient for MVP |
| **Railway** | $5 trial credit/mo | ~$5-10/mo for always-on service |
| **Neon** | 0.5 GB, 190 compute hours/mo | Sufficient for MVP |

---

## Testing Strategy

### Test Categories

| Category | Scope | Tools |
|---|---|---|
| **Feed validation** | All RSS URLs reachable, correct tier assignment | Vitest |
| **GeoJSON integrity** | EEZ polygon valid, WPS features correctly placed | Vitest |
| **Scoring algorithms** | RSI, WPS Tension, Typhoon Impact produce expected values | Vitest |
| **Entity registry** | All PH entities resolve correctly by alias/keyword | Vitest |
| **Edge function handlers** | Correct response schemas, cache behavior | Vitest |
| **Map layer parity** | All layers render without errors | Playwright |
| **Filipino tokenization** | Stop word removal, Taglish handling | Vitest |

### Critical Test Cases

- WPS EEZ boundary polygon is valid and closed
- Scarborough Shoal coordinates are correct (15.15°N, 117.76°E)
- RSI scores stay within 0-100 range under all input combinations
- PAGASA signal number mapping produces correct zone colors
- Filipino stop words are properly removed from clustering tokenizer
- Circuit breakers trigger after 3 consecutive failures per source
- PHT timezone (UTC+8) renders correctly for all timestamps

---

## Migration from World Monitor

### Phase 1 — New Architecture Setup (Week 1-2)

1. Fork repository, set up monorepo structure (`frontend/`, `server/`, `shared/`)
2. **Set up Neon PostgreSQL** — create project, define schema, run initial migrations
3. **Set up Railway backend** — Fastify server with health endpoint, connect to Neon
4. **Set up Netlify frontend** — Vite build, netlify.toml with API proxy redirects
5. Port World Monitor's frontend to `frontend/` (strip multi-variant, strip edge function calls)
6. Replace browser-side data fetching with API client calling Railway backend
7. Update map defaults (center, zoom, regional presets)
8. Verify end-to-end: frontend (Netlify) → backend (Railway) → database (Neon)

### Phase 2 — Philippine Backend Core (Week 3-4)

1. **Build RSS scraper** — cron-scheduled, writes to Postgres `news_articles` table
2. **Build PAGASA scraper** — typhoon + weather bulletin parser, writes to Postgres
3. **Build PHIVOLCS scraper** — earthquake + volcano feed parser, writes to Postgres
4. **Build API routes** — `/api/news`, `/api/disaster`, `/api/wps`, `/api/risk-scores`
5. Implement WPS GeoJSON layers on frontend (EEZ, features, nine-dash line)
6. Implement Philippine Regional Stability Index (scorer runs on Railway, stores in Postgres)
7. Implement WPS Tension Score algorithm
8. Build Philippine entity registry in `shared/`
9. Adapt AI summarization prompts + build `/api/summarize` with Postgres caching

### Phase 3 — Data Layers, Panels & Real-Time (Week 5-6)

1. **Build AIS WebSocket integration** — Railway connects to AISStream, relays to frontend via WSS
2. **Build WPS Panel** — dedicated maritime monitoring with vessel list, tension score, incident timeline
3. **Build Disaster Panel** — unified PAGASA + PHIVOLCS + NDRRMC
4. **Build OFW Panel** — remittance data + diaspora news (from BSP scraper)
5. Implement PSE market scraper + `/api/market` endpoint
6. Implement BSP economic data scraper
7. Add EDCA sites and AFP bases to frontend map config
8. Build `/api/military` endpoint (OpenSky integration for PH FIR)
9. Configure AIS vessel classification for PH EEZ (CCG/PLAN/PH Navy detection)

### Phase 4 — Polish & Deploy (Week 7-8)

1. Filipino language support (stop words, entity aliases, UI labels)
2. Mobile optimization for PH mobile data conditions
3. Performance testing on 4G/LTE connections
4. Full test suite (frontend unit, backend API, scraper integration, DB queries)
5. Documentation completion (DATABASE.md, API reference)
6. **Production deployment:** Netlify (frontend) + Railway (backend) + Neon (database)
7. Configure Netlify custom domain + SSL
8. Configure Railway production environment variables
9. Set up Neon database branching (main → production, dev → development)
10. Monitoring and alerting (Railway logs, Neon metrics, optional Sentry)

---

## Appendix: Philippine Geographic Constants

```typescript
// Philippine bounding box
const PH_BOUNDS = {
  north: 21.5,    // Batanes
  south: 4.5,     // Tawi-Tawi
  west: 116.0,    // Western Palawan / WPS
  east: 127.0,    // Eastern Samar
};

// Map default center
const PH_CENTER = { lat: 12.8797, lon: 121.7740 };
const PH_DEFAULT_ZOOM = 6;

// Philippine EEZ approximate bounding box (for AIS/API filtering)
const PH_EEZ_BOUNDS = {
  north: 22.0,
  south: 3.0,
  west: 114.0,    // Extends into WPS
  east: 128.0,
};

// Timezone
const PH_TIMEZONE = 'Asia/Manila'; // UTC+8
```
