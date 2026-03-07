/**
 * Bureau of Meteorology — Weather Warnings
 *
 * Source: Bureau of Meteorology (bom.gov.au)
 * Format: CAP XML / RSS / JSON (via bom.gov.au/fwo/)
 * Auth: No key required (public data)
 * Attribution: "Source: Bureau of Meteorology (Commonwealth of Australia)"
 * Licence: Crown Copyright — re-use under CC BY 3.0 AU
 *
 * Provides:
 * - Severe weather warnings (storms, cyclones, heatwaves)
 * - Marine warnings
 * - Flood warnings (also handled separately by flood adapter)
 * - Fire weather warnings
 *
 * Integration difficulty: Medium
 * - CAP XML needs XML parsing
 * - Coordinates sometimes as polygons
 * - Multiple warning types across different endpoints
 */

import { BaseAUAdapter } from './base-adapter';
import type { AUEvent, AUEventCategory, AUState, AUSourceType, AUEventSubcategory } from '../types';
import { normaliseSeverity, parseDate } from '../types';

// BOM warnings RSS feed (national)
const BOM_WARNINGS_URL = 'https://www.bom.gov.au/fwo/IDZ00060.warnings_land_nsw.xml';

// BOM CAP feed (preferred — standard alert format)
const BOM_CAP_FEED = 'https://reg.bom.gov.au/fwo/IDZ00300.warnings_land_all.xml';

// State-specific warning product IDs
const STATE_WARNING_FEEDS: Record<AUState, string> = {
  NSW: 'IDN11060',
  VIC: 'IDV10750',
  QLD: 'IDQ20885',
  WA:  'IDW21035',
  SA:  'IDS11055',
  TAS: 'IDT13600',
  NT:  'IDD11035',
  ACT: 'IDN11060', // ACT uses NSW feed
};

function mapBomSubcategory(type: string): AUEventSubcategory {
  const lc = type.toLowerCase();
  if (lc.includes('storm') || lc.includes('thunder')) return 'thunderstorm';
  if (lc.includes('cyclone')) return 'cyclone';
  if (lc.includes('heat')) return 'heatwave';
  if (lc.includes('wind')) return 'wind';
  if (lc.includes('hail')) return 'hail';
  if (lc.includes('fog')) return 'fog';
  if (lc.includes('dust')) return 'dust-storm';
  if (lc.includes('flood')) return 'flash-flood';
  return 'storm';
}

export class BOMWarningsAdapter extends BaseAUAdapter {
  id = 'bom-warnings' as const;
  name = 'BOM Weather Warnings';
  category: AUEventCategory = 'severe-weather';
  states: AUState[] = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'];
  sourceType: AUSourceType = 'cap';
  attribution = 'Source: Bureau of Meteorology (Commonwealth of Australia)';
  refreshIntervalMs = 5 * 60 * 1000; // 5 minutes

  protected async fetchAndParse(): Promise<AUEvent[]> {
    // Fetch the national warnings JSON endpoint (simpler than parsing CAP XML client-side)
    // This should be proxied through our API route to avoid CORS
    const proxyUrl = `/api/au/bom-warnings`;

    try {
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const warnings = data?.warnings || data || [];

      return warnings.map((w: Record<string, unknown>) => {
        const lat = (w.lat || w.latitude || -25.0) as number;
        const lng = (w.lon || w.longitude || 134.0) as number;

        return {
          id: `bom-warnings:${w.id || w.identifier || Math.random().toString(36).slice(2)}`,
          source: this.id,
          sourceType: 'cap' as const,
          title: (w.title || w.headline || 'BOM Warning') as string,
          summary: (w.description || w.body || '') as string,
          category: 'severe-weather' as const,
          subcategory: mapBomSubcategory((w.type || w.event_type || '') as string),
          severity: normaliseSeverity(w.severity as string),
          state: (w.state || undefined) as AUState | undefined,
          region: w.area as string || undefined,
          latitude: lat,
          longitude: lng,
          geometry: w.polygon ? { type: 'Polygon', coordinates: w.polygon } as GeoJSON.Polygon : null,
          status: 'active' as const,
          startedAt: parseDate(w.issued || w.sent),
          updatedAt: parseDate(w.updated || w.issued),
          expiresAt: w.expiry ? parseDate(w.expiry) : undefined,
          tags: ['weather', (w.type || '') as string].filter(Boolean),
          canonicalUrl: (w.web || `http://www.bom.gov.au/`) as string,
          attribution: this.attribution,
          rawPayload: w,
        } satisfies AUEvent;
      });
    } catch (err) {
      console.warn('[AU:bom-warnings] fetch failed, will retry', err);
      return [];
    }
  }
}

export { STATE_WARNING_FEEDS };
