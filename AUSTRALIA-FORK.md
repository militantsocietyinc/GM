# Australia Monitor — Fork Implementation Plan

## 1. Repo Audit

### Framework & Stack
- **Frontend**: Vite 6 + Preact 10 (lightweight React)
- **Map**: Deck.gl 9 + MapLibre GL 5 (WebGL) + D3 (SVG fallback) + Three.js (globe)
- **Basemap**: Protomaps self-hosted tiles (PMTiles)
- **Backend**: Vercel Edge Functions (api/ directory)
- **Desktop**: Tauri 2.10
- **Proto**: Buf protobuf RPC services (server/worldmonitor/)
- **Testing**: Playwright E2E + Node native tests

### Architecture
- **Variant system**: `VITE_VARIANT` env var or hostname-based detection → loads variant-specific panels, feeds, layers, and metadata
- **Existing variants**: full, tech, finance, happy, commodity
- **Config layer**: `src/config/` — feeds.ts (200+ RSS feeds), geo.ts (static features), panels.ts (variant-aware panel/layer selection), variant-meta.ts (SEO/OG metadata)
- **Data flow**: Config → Data Loader → Services → Clustering/Classification → Map + Panels
- **Services**: 100+ modular services in `src/services/`, each handling a domain
- **Map layers**: 55+ boolean flags in `MapLayers` interface, toggled per variant

### Key Files
| File | Role |
|------|------|
| `src/config/variant.ts` | Runtime variant detection (hostname / env / localStorage) |
| `src/config/panels.ts` | Variant-aware panel + layer + category exports |
| `src/config/variant-meta.ts` | SEO metadata per variant |
| `src/config/map-layer-definitions.ts` | Layer registry + variant layer ordering |
| `src/config/feeds.ts` | 200+ RSS feed definitions |
| `src/types/index.ts` | All TypeScript interfaces (MapLayers, NewsItem, etc.) |
| `src/app/data-loader.ts` | Orchestrates all data fetching |
| `src/components/DeckGLMap.ts` | Main WebGL map renderer (203KB) |
| `api/` | Vercel Edge Functions (30+ routes) |

---

## 2. Reusable Pieces

| Component | Reuse Level | Notes |
|-----------|-------------|-------|
| Variant system | **Direct** | Just add 'australia' as a new variant |
| RSS feed infrastructure | **Direct** | Add AU feeds to existing system |
| Map renderer (Deck.gl + MapLibre) | **Direct** | Change default center/zoom |
| Panel grid system | **Direct** | Configure AU-specific panels |
| Clustering + classification | **Direct** | Works on any NewsItem |
| Data freshness tracking | **Direct** | Add AU source IDs |
| Circuit breaker / retry logic | **Direct** | Used by all source adapters |
| API proxy pattern (edge functions) | **Direct** | Same pattern for AU API routes |
| Weather alerts layer | **Direct** | Already exists — add BOM data |
| Fire layer (NASA FIRMS) | **Direct** | Already exists — supplement with state feeds |
| Earthquake layer (USGS) | **Direct** | Already exists — add GA data |
| i18n framework | **Direct** | Add en-AU locale strings |
| Persistent cache | **Direct** | Same caching for AU data |
| AI summarization pipeline | **Adapt** | Point at AU events instead of global |

---

## 3. Required Refactors

1. **Variant detection** (`src/config/variant.ts`): Add 'australia' to valid variants, detect `australiamonitor.app` hostname
2. **Panels export** (`src/config/panels.ts`): Wire AU panels/layers into the variant switch
3. **CORS** (`api/_cors.js`): Allow `australiamonitor.app` origins
4. **Map default viewport**: Override center/zoom for AU variant (currently global)
5. **Feed system**: AU-specific feed list (separate from global feeds)

None of these are breaking changes — all additive to existing code.

---

## 4. Australia Fork Architecture

### New Directory: `src/au/`
```
src/au/
├── index.ts              # Barrel export
├── types.ts              # AUEvent schema + validation + enums
├── regions.ts            # Region presets (states, cities, bbox)
├── source-registry.ts    # Adapter orchestrator
└── sources/
    ├── index.ts           # Source barrel
    ├── base-adapter.ts    # Base class with circuit breaker
    ├── nsw-live-traffic.ts
    ├── nsw-traffic-cameras.ts
    ├── qld-traffic.ts
    ├── vic-traffic.ts
    ├── bom-warnings.ts
    ├── bushfires.ts
    ├── ga-earthquakes.ts
    ├── flood-warnings.ts
    ├── transport-disruptions.ts
    └── au-news.ts
```

### New API Routes: `api/au/`
```
api/au/
├── bushfires.js       # NSW RFS + VIC Emergency GeoJSON proxy
├── earthquakes.js     # GA + USGS (AU bbox) proxy
├── bom-warnings.js    # BOM weather warnings RSS proxy
├── floods.js          # BOM flood warnings RSS proxy
├── transport.js       # TfNSW GTFS-RT alerts proxy
└── health.js          # Source health check endpoint
```

### Modified Files
- `src/config/variant.ts` — added 'australia' variant detection
- `src/config/variant-meta.ts` — added australia SEO metadata
- `src/config/panels.ts` — added AU panels, layers, categories
- `src/config/map-layer-definitions.ts` — added 'australia' to MapVariant + layer order
- `api/_cors.js` — added australiamonitor.app to allowed origins
- `.env.example` — added AU-specific API keys

---

## 5. AU Event Schema

See `src/au/types.ts` for full TypeScript definitions.

### Core Interface: `AUEvent`
- 30+ fields covering all AU source types
- Stable IDs: `${source}:${sourceId}`
- WGS84 coordinates with AU bbox validation
- Optional GeoJSON geometry (fire perimeters, flood zones)
- Camera URLs (HLS/MJPEG)
- Severity: unknown → minor → moderate → major → extreme → catastrophic
- State/region/suburb for filtering
- Raw payload preserved for debugging
- AI summary field for async enrichment

### Validation
- `validateAUEvent()` — structural validation
- `isWithinAustralia()` — bbox check
- `normaliseSeverity()` — free-text to enum mapping
- `parseDate()` — robust date coercion

---

## 6. Data Source Plan

### Phase 1 (MVP)

| Source | Data | Difficulty | Method | Attribution |
|--------|------|-----------|--------|-------------|
| **TfNSW Traffic Incidents** | NSW crashes, roadworks, closures | Easy | API (JSON) | CC BY 4.0, Transport for NSW |
| **TfNSW Traffic Cameras** | ~350 NSW cameras | Easy | API (JSON) | CC BY 4.0, Transport for NSW |
| **NSW RFS** | Bushfire incidents | Easy | GeoJSON feed | NSW Rural Fire Service |
| **BOM Warnings** | Weather warnings all states | Medium | RSS/CAP XML | Crown Copyright CC BY 3.0 AU |
| **GA Earthquakes** | AU seismic events | Easy | GeoJSON API | CC BY 4.0, Geoscience Australia |
| **USGS (AU bbox)** | Supplementary quakes | Easy | GeoJSON API | Public domain |
| **ABC/SBS/SMH/Guardian AU** | National news | Easy | RSS feeds | Standard RSS terms |

### Phase 2

| Source | Data | Difficulty | Method |
|--------|------|-----------|--------|
| **QLD Traffic (DTMR)** | QLD incidents | Medium | API (needs key) |
| **VIC Emergency** | VIC all-hazards | Easy | GeoJSON feed |
| **BOM Flood Warnings** | All-state floods | Medium | RSS/CAP XML |
| **TfNSW Transit Alerts** | Train/bus/ferry disruptions | Medium | GTFS-RT |
| **PTV Victoria** | VIC transit alerts | Medium | GTFS-RT |
| **NASA FIRMS** | Satellite fire hotspots (already in app) | Direct reuse | API |

### Phase 3

| Source | Data | Difficulty | Method |
|--------|------|-----------|--------|
| **Public webcams** | Surf cams, city cams | Hard | Web scraping + directory |
| **SA/WA/TAS/NT fire services** | Multi-state bushfires | Medium | Mixed feeds |
| **TransLink QLD** | QLD transit | Medium | GTFS-RT |
| **Transperth WA** | WA transit | Medium | GTFS-RT |

### Traffic Cameras vs Public Cameras
- **Traffic cameras** = official state road authority feeds (TfNSW, VicRoads, TMR QLD). Reliable, documented APIs, CC BY licensed.
- **Public/open cameras** = community webcams, surf cams, weather cams. Phase 3 — requires curation, licensing verification, and content moderation.

---

## 7. UX / Layer Plan

### Map Defaults (Australia Variant)
- **Center**: [134.0, -25.5] (centre of Australia)
- **Zoom**: 4 (shows all of AU)
- **Max bounds**: [[105, -50], [165, -5]] (AU + surrounding ocean)

### Layer Toggles
Active AU layers map to existing `MapLayers` keys where possible:
- `fires` → Bushfires (state feeds + NASA FIRMS)
- `weather` → BOM weather warnings
- `natural` → Earthquakes (GA + USGS)
- `climate` → Climate anomalies
- `outages` → Internet/power outages

New AU-specific data is handled by the source adapter registry and rendered as custom Deck.gl layers (traffic incidents, cameras, floods, transport — not global MapLayers toggles).

### Region Filter
Dropdown selector with presets:
- Australia (country)
- States: NSW, VIC, QLD, WA, SA, TAS, NT, ACT
- Cities: Sydney, Melbourne, Brisbane, Perth, Adelaide, Hobart, Darwin, Canberra
- Key regions: Gold Coast, Sunshine Coast, Newcastle, Wollongong, Geelong

Selecting a region:
1. Flies the map to the preset center/zoom
2. Filters events by state/bbox
3. Updates panel data to show regional content

### Panel Layout
Priority 1 (above fold): Map, Headlines, AU Summary, Traffic, Cameras, Bushfires, Weather, Floods, Earthquakes, Transport, State News
Priority 2 (below fold): Business, Markets, Commodities, Tech, Politics, Satellite Fires, Public Cameras, Monitors

---

## 8. Implementation Phases

### Phase 1: Australia Default + Core Sources
**Scope**: Make the app load as an Australia-focused dashboard with NSW traffic + cameras, bushfires, weather, earthquakes, and AU news.

**Files touched**:
- `src/config/variant.ts` ✅
- `src/config/variant-meta.ts` ✅
- `src/config/panels.ts` ✅
- `src/config/map-layer-definitions.ts` ✅
- `src/au/` (all new files) ✅
- `api/au/` (all new routes) ✅
- `api/_cors.js` ✅
- `.env.example` ✅

**Dependencies**: TfNSW API key (free), BOM data (public)

**Risks**:
- BOM feeds use XML/CAP — edge runtime XML parsing is limited
- TfNSW API rate limits unclear at scale

**Testing**: Manual verification of each API route, check map renders AU by default, verify panels show AU data

**Acceptance criteria**:
- `VITE_VARIANT=australia` loads Australia-centered map
- NSW traffic incidents appear on map
- NSW traffic cameras load snapshots
- Bushfire markers from NSW RFS
- Weather warnings from BOM
- Earthquake markers from GA
- AU news feeds in panels
- Region selector works for all presets

### Phase 2: Multi-State + Weather + Transport
**Scope**: Add VIC, QLD, WA, SA support. Complete weather/flood/transport integration.

**Likely files**:
- `src/au/sources/` — expand state adapters
- `api/au/` — add state-specific proxy routes
- `src/components/` — AU summary panel, traffic camera grid
- `src/app/data-loader.ts` — wire AU sources into refresh cycle
- `src/services/data-freshness.ts` — add AU source IDs

**Dependencies**: QLD Traffic API key, PTV API key

**Risks**:
- State API inconsistency (each state has slightly different formats)
- GTFS-RT protobuf parsing in browser requires `@bufbuild/protobuf`

**Testing**: E2E tests per state, source health monitoring dashboard

**Acceptance criteria**:
- All 8 states/territories have at least weather + fire coverage
- Transit disruptions for NSW + VIC
- Flood warnings all states
- Source health endpoint shows all sources green

### Phase 3: Cameras + AI + Polish
**Scope**: Public cameras, saved views, alerts, AI enrichment, performance.

**Likely files**:
- `src/au/sources/public-cameras.ts` — curated webcam directory
- `src/components/SavedViewsPanel.ts` — bookmark region+filter combos
- `src/services/ai-flow-settings.ts` — AU summary prompt
- `src/components/AustraliaSummaryPanel.ts` — AI-generated overview
- Performance: layer clustering, viewport-based data loading

**Dependencies**: AI API key for summaries, camera licensing verification

**Risks**:
- Public camera reliability varies wildly
- AI summary quality depends on prompt engineering + input data quality
- Camera CORS/embedding restrictions

**Testing**: Lighthouse performance audit, camera availability monitoring, AI summary review

**Acceptance criteria**:
- Public cameras browsable by region
- AI summary updates every 15 minutes
- Map performs well with 1000+ simultaneous markers
- Saved views persist across sessions

---

## 9. Concrete Code Changes (Delivered)

### New Files Created
1. `src/au/types.ts` — AUEvent schema, validation, enums
2. `src/au/regions.ts` — 25 region presets
3. `src/au/index.ts` — barrel export
4. `src/au/source-registry.ts` — adapter orchestrator
5. `src/au/sources/index.ts` — source barrel
6. `src/au/sources/base-adapter.ts` — base class with circuit breaker
7. `src/au/sources/nsw-live-traffic.ts` — TfNSW incidents adapter
8. `src/au/sources/nsw-traffic-cameras.ts` — TfNSW cameras adapter
9. `src/au/sources/qld-traffic.ts` — QLD DTMR adapter
10. `src/au/sources/vic-traffic.ts` — VicRoads adapter
11. `src/au/sources/bom-warnings.ts` — BOM weather adapter
12. `src/au/sources/bushfires.ts` — multi-state bushfire adapter
13. `src/au/sources/ga-earthquakes.ts` — GA + USGS adapter
14. `src/au/sources/flood-warnings.ts` — BOM floods adapter
15. `src/au/sources/transport-disruptions.ts` — transit alerts adapter
16. `src/au/sources/au-news.ts` — AU RSS feeds + source tiers
17. `src/config/variants/australia.ts` — AU variant config
18. `api/au/bushfires.js` — bushfire proxy route
19. `api/au/earthquakes.js` — earthquake proxy route
20. `api/au/bom-warnings.js` — weather warnings proxy
21. `api/au/floods.js` — flood warnings proxy
22. `api/au/transport.js` — transport alerts proxy
23. `api/au/health.js` — source health check

### Modified Files
24. `src/config/variant.ts` — added 'australia' to valid variants
25. `src/config/variant-meta.ts` — added australia SEO metadata
26. `src/config/panels.ts` — added AU panels, layers, category map entries
27. `src/config/map-layer-definitions.ts` — added 'australia' MapVariant + layer order
28. `api/_cors.js` — added australiamonitor.app to CORS allowlist
29. `.env.example` — added TFNSW_API_KEY, QLD_TRAFFIC_API_KEY, VITE_VARIANT

---

## 10. Risks / Edge Cases

| Risk | Mitigation |
|------|-----------|
| BOM XML parsing in edge runtime | Simple regex parser for RSS (no DOM parser needed) |
| TfNSW API key rotation | Key stored in env vars, easy to rotate |
| State API downtime | Circuit breaker + stale cache fallback per adapter |
| Camera image CORS | Proxy through API route if needed |
| Bushfire season load spikes | Edge function caching (3-5 min TTL), CDN |
| Coordinate quality varies | AU bbox validation rejects out-of-range points |
| Time zones (AEST/AEDT/AWST etc.) | All dates stored as UTC, display conversion in frontend |
| Mobile performance with many markers | Viewport-based filtering, clustering via supercluster |
| RSS feed changes/breakage | Feed failure isolated per source, health monitoring |

---

## 11. Recommended First Commit

**This commit** — everything listed in Section 9. It establishes:
1. The 'australia' variant in the existing variant system
2. The `src/au/` module with all types, adapters, and registry
3. AU-specific API proxy routes
4. Config changes to wire it all together
5. No changes to existing variant behavior (full/tech/finance/happy/commodity untouched)

**Immediate next steps after merge**:
1. Get a TfNSW API key and test NSW traffic data end-to-end
2. Wire `src/au/source-registry.ts` into `src/app/data-loader.ts`
3. Add AU event rendering to DeckGLMap.ts (custom Deck.gl layers for traffic/cameras)
4. Build the Australia Summary panel component
5. Add region selector to the header
