/**
 * Geoscience Australia — Earthquakes
 *
 * Source: Geoscience Australia (ga.gov.au)
 * Format: GeoJSON REST API
 * Auth: No key required
 * Attribution: "Source: Geoscience Australia"
 * Licence: Creative Commons Attribution 4.0
 *
 * Also supplements with USGS data (already available in worldmonitor)
 * filtered to Australian bbox.
 *
 * Integration difficulty: Easy
 * - Clean GeoJSON
 * - No auth
 * - Standard format similar to USGS
 */

import { BaseAUAdapter } from './base-adapter';
import type { AUEvent, AUEventCategory, AUState, AUSourceType } from '../types';
import { normaliseSeverity, parseDate, AU_BBOX } from '../types';

const GA_EARTHQUAKES_URL = 'https://earthquakes.ga.gov.au/quakes/quake.json';

function magnitudeToSeverity(mag: number): string {
  if (mag >= 6.0) return 'extreme';
  if (mag >= 5.0) return 'major';
  if (mag >= 4.0) return 'moderate';
  if (mag >= 2.5) return 'minor';
  return 'minor';
}

function coordsToState(lat: number, lon: number): AUState | undefined {
  // Rough state assignment based on longitude/latitude bands
  if (lon < 129) return 'WA';
  if (lon < 138) {
    if (lat < -26) return 'SA';
    return 'NT';
  }
  if (lon < 141) {
    if (lat < -34) return 'SA';
    if (lat < -26) return 'SA';
    return 'NT';
  }
  if (lon < 150) {
    if (lat < -39) return 'VIC';
    if (lat < -34) return 'VIC';
    return 'NSW';
  }
  if (lat < -39) return 'TAS';
  if (lat < -28) return 'NSW';
  return 'QLD';
}

export class GAEarthquakeAdapter extends BaseAUAdapter {
  id = 'ga-earthquakes' as const;
  name = 'Geoscience Australia Earthquakes';
  category: AUEventCategory = 'earthquake';
  states: AUState[] = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'];
  sourceType: AUSourceType = 'api';
  attribution = 'Source: Geoscience Australia';
  refreshIntervalMs = 5 * 60 * 1000; // 5 minutes

  protected async fetchAndParse(): Promise<AUEvent[]> {
    // Fetch via our proxy to handle CORS and add USGS Australian events
    const proxyUrl = `/api/au/earthquakes`;

    try {
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const features = data?.features || data || [];

      return features
        .map((f: Record<string, unknown>) => {
          const props = (f.properties || f) as Record<string, unknown>;
          const geom = f.geometry as { coordinates?: number[] } | undefined;
          const coords = geom?.coordinates || [];
          const lng = coords[0] || 134;
          const lat = coords[1] || -25;
          const depth = coords[2] || 0;
          const mag = (props.mag || props.magnitude || 0) as number;

          // Filter to Australian bbox
          if (lat < AU_BBOX[1] || lat > AU_BBOX[3] || lng < AU_BBOX[0] || lng > AU_BBOX[2]) {
            return null;
          }

          return {
            id: `ga-earthquakes:${props.id || props.eventId || Math.random().toString(36).slice(2)}`,
            source: this.id,
            sourceType: 'api' as const,
            title: `M${mag.toFixed(1)} earthquake — ${(props.place || props.description || 'Australia')}`,
            summary: `Magnitude ${mag.toFixed(1)} at ${depth.toFixed(0)}km depth. ${props.place || ''}`.trim(),
            category: 'earthquake' as const,
            subcategory: mag >= 2.5 ? 'felt' : 'unfelt',
            severity: normaliseSeverity(magnitudeToSeverity(mag)),
            state: coordsToState(lat, lng),
            latitude: lat,
            longitude: lng,
            status: 'active' as const,
            startedAt: parseDate(props.time || props.origin_time),
            updatedAt: parseDate(props.updated || props.time),
            tags: ['earthquake', `M${mag.toFixed(1)}`],
            canonicalUrl: (props.url || `https://earthquakes.ga.gov.au/`) as string,
            attribution: this.attribution,
            confidence: (props.quality || 1) as number,
            rawPayload: props,
          } satisfies AUEvent;
        })
        .filter(Boolean) as AUEvent[];
    } catch (err) {
      console.warn('[AU:ga-earthquakes] fetch failed', err);
      return [];
    }
  }
}
