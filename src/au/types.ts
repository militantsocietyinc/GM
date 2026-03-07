/**
 * Australia Monitor — Normalized Event Schema
 *
 * A common model for all AU data sources. Every adapter maps raw API/feed
 * payloads into this shape before it hits the map, panels, or cache.
 */

// ---------------------------------------------------------------------------
// Enums & Literal Unions
// ---------------------------------------------------------------------------

export type AUEventCategory =
  | 'traffic-incident'
  | 'traffic-camera'
  | 'open-camera'
  | 'bushfire'
  | 'flood'
  | 'severe-weather'
  | 'earthquake'
  | 'transport-disruption'
  | 'news'
  | 'emergency'
  | 'hazard'
  | 'other';

export type AUEventSubcategory =
  // traffic
  | 'crash' | 'roadwork' | 'congestion' | 'closure' | 'hazard'
  // bushfire
  | 'grass-fire' | 'structure-fire' | 'planned-burn' | 'out-of-control' | 'being-controlled' | 'under-control'
  // flood
  | 'flash-flood' | 'riverine' | 'coastal' | 'dam-release'
  // weather
  | 'storm' | 'cyclone' | 'heatwave' | 'wind' | 'thunderstorm' | 'hail' | 'fog' | 'dust-storm'
  // transport
  | 'train-delay' | 'train-cancellation' | 'bus-delay' | 'ferry-delay' | 'tram-delay' | 'track-work'
  // earthquake
  | 'felt' | 'unfelt'
  // generic
  | 'other';

export type AUSeverity = 'unknown' | 'minor' | 'moderate' | 'major' | 'extreme' | 'catastrophic';

export type AUState = 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'NT' | 'ACT';

export type AUEventStatus =
  | 'active'
  | 'resolved'
  | 'scheduled'
  | 'cancelled'
  | 'expired'
  | 'unknown';

export type AUSourceType =
  | 'api'          // REST/JSON API
  | 'rss'          // RSS/Atom feed
  | 'geojson'      // GeoJSON endpoint
  | 'cap'          // Common Alerting Protocol XML
  | 'scrape'       // HTML scrape (last resort)
  | 'websocket';   // Live stream

// ---------------------------------------------------------------------------
// Core Event Interface
// ---------------------------------------------------------------------------

export interface AUEvent {
  /** Stable unique ID: `${source}:${sourceId}` */
  id: string;

  /** Source adapter key, e.g. 'nsw-livetraffic', 'bom-warnings' */
  source: string;

  /** How the source delivers data */
  sourceType: AUSourceType;

  /** Short headline */
  title: string;

  /** Longer description (may contain HTML — sanitise before render) */
  summary: string;

  /** Primary category */
  category: AUEventCategory;

  /** Optional sub-classification */
  subcategory?: AUEventSubcategory;

  /** Severity level */
  severity: AUSeverity;

  /** Australian state / territory */
  state?: AUState;

  /** Region name (e.g. 'Hunter Valley', 'Gold Coast Hinterland') */
  region?: string;

  /** Suburb or locality */
  suburb?: string;

  /** WGS84 latitude */
  latitude: number;

  /** WGS84 longitude */
  longitude: number;

  /** Optional GeoJSON geometry for polygons / lines (fire perimeters, flood zones, road segments) */
  geometry?: GeoJSON.Geometry | null;

  /** Image URL (thumbnail, satellite, camera snapshot) */
  imageUrl?: string;

  /** Live camera stream URL (HLS / MJPEG / RTSP) */
  cameraUrl?: string;

  /** Current lifecycle status */
  status: AUEventStatus;

  /** When the event started (or was first reported) */
  startedAt: Date;

  /** Last update from source */
  updatedAt: Date;

  /** When the event should be considered expired */
  expiresAt?: Date;

  /** Free-form tags for filtering */
  tags: string[];

  /** Canonical link back to the source */
  canonicalUrl?: string;

  /** Required attribution text (licence compliance) */
  attribution?: string;

  /** Confidence score 0-1 (useful for AI-classified events) */
  confidence?: number;

  /** Stash the raw payload for debugging / re-processing */
  rawPayload?: unknown;

  /** AI-generated summary (populated async after ingestion) */
  aiSummary?: string;
}

// ---------------------------------------------------------------------------
// Camera-specific types
// ---------------------------------------------------------------------------

export interface AUCamera {
  id: string;
  source: string;
  title: string;
  state: AUState;
  region?: string;
  latitude: number;
  longitude: number;
  imageUrl: string;
  streamUrl?: string;
  refreshIntervalMs: number;
  direction?: string;
  roadName?: string;
  attribution?: string;
  lastUpdated: Date;
  type: 'traffic' | 'public' | 'surf' | 'weather';
}

// ---------------------------------------------------------------------------
// Region Preset
// ---------------------------------------------------------------------------

export interface AURegionPreset {
  id: string;
  label: string;
  center: [number, number]; // [lng, lat]
  zoom: number;
  /** Bounding box for data filtering [west, south, east, north] */
  bbox: [number, number, number, number];
  states?: AUState[];
}

// ---------------------------------------------------------------------------
// Source Adapter Interface
// ---------------------------------------------------------------------------

export interface AUSourceHealth {
  lastFetch: Date | null;
  lastSuccess: Date | null;
  lastError: string | null;
  consecutiveFailures: number;
  itemCount: number;
  avgLatencyMs: number;
}

export interface AUSourceAdapter<T = AUEvent> {
  /** Unique key, e.g. 'nsw-livetraffic' */
  id: string;

  /** Human-readable name */
  name: string;

  /** Data category this adapter produces */
  category: AUEventCategory;

  /** Which states this source covers */
  states: AUState[];

  /** How the source delivers data */
  sourceType: AUSourceType;

  /** Required attribution */
  attribution: string;

  /** Refresh interval in ms */
  refreshIntervalMs: number;

  /** Fetch and parse raw data into normalized events */
  fetch(): Promise<T[]>;

  /** Current health status */
  health: AUSourceHealth;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/** Bounding box for mainland Australia + Tasmania */
export const AU_BBOX: [number, number, number, number] = [112.0, -44.0, 154.0, -10.0];

export function isWithinAustralia(lat: number, lon: number): boolean {
  return lat >= AU_BBOX[1] && lat <= AU_BBOX[3] && lon >= AU_BBOX[0] && lon <= AU_BBOX[2];
}

export function validateAUEvent(event: Partial<AUEvent>): string[] {
  const errors: string[] = [];

  if (!event.id) errors.push('id is required');
  if (!event.source) errors.push('source is required');
  if (!event.title) errors.push('title is required');
  if (typeof event.latitude !== 'number' || isNaN(event.latitude)) errors.push('latitude must be a number');
  if (typeof event.longitude !== 'number' || isNaN(event.longitude)) errors.push('longitude must be a number');
  if (event.latitude !== undefined && event.longitude !== undefined) {
    if (!isWithinAustralia(event.latitude, event.longitude)) {
      errors.push(`coordinates (${event.latitude}, ${event.longitude}) outside Australia bbox`);
    }
  }
  if (!event.category) errors.push('category is required');
  if (!event.status) errors.push('status is required');
  if (!event.startedAt) errors.push('startedAt is required');
  if (!event.updatedAt) errors.push('updatedAt is required');

  return errors;
}

/** Coerce a raw date value (string | number | Date) into a Date, or return now() */
export function parseDate(raw: unknown): Date {
  if (raw instanceof Date) return raw;
  if (typeof raw === 'string' || typeof raw === 'number') {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? new Date() : d;
  }
  return new Date();
}

/** Map a free-text severity string to AUSeverity */
export function normaliseSeverity(raw: string | undefined): AUSeverity {
  if (!raw) return 'unknown';
  const s = raw.toLowerCase().trim();
  if (['extreme', 'catastrophic', 'emergency'].includes(s)) return 'extreme';
  if (['major', 'severe', 'high', 'warning'].includes(s)) return 'major';
  if (['moderate', 'medium', 'watch'].includes(s)) return 'moderate';
  if (['minor', 'low', 'advice', 'information'].includes(s)) return 'minor';
  return 'unknown';
}
