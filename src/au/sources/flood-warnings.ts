/**
 * Flood Warnings — BOM + State Agencies
 *
 * Source: Bureau of Meteorology flood warnings
 * Format: CAP XML / RSS
 * Auth: No key required
 * Attribution: "Source: Bureau of Meteorology (Commonwealth of Australia)"
 * Licence: Crown Copyright — CC BY 3.0 AU
 *
 * BOM publishes flood warnings for all states/territories.
 * These are distinct from general weather warnings and cover:
 * - River level warnings
 * - Flash flood warnings
 * - Coastal flooding
 * - Dam release notices
 *
 * Integration difficulty: Medium
 * - Uses same BOM infrastructure as weather warnings
 * - Polygon geometries for flood zones
 * - Multiple warning levels (minor, moderate, major)
 */

import { BaseAUAdapter } from './base-adapter';
import type { AUEvent, AUEventCategory, AUState, AUSourceType, AUEventSubcategory } from '../types';
import { normaliseSeverity, parseDate } from '../types';

function mapFloodType(text: string): AUEventSubcategory {
  const lc = text.toLowerCase();
  if (lc.includes('flash')) return 'flash-flood';
  if (lc.includes('river') || lc.includes('creek')) return 'riverine';
  if (lc.includes('coastal') || lc.includes('storm tide')) return 'coastal';
  if (lc.includes('dam')) return 'dam-release';
  return 'other';
}

export class FloodWarningsAdapter extends BaseAUAdapter {
  id = 'au-floods' as const;
  name = 'Australian Flood Warnings';
  category: AUEventCategory = 'flood';
  states: AUState[] = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'];
  sourceType: AUSourceType = 'cap';
  attribution = 'Source: Bureau of Meteorology (Commonwealth of Australia)';
  refreshIntervalMs = 5 * 60 * 1000;

  protected async fetchAndParse(): Promise<AUEvent[]> {
    const proxyUrl = `/api/au/floods`;

    try {
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const warnings = data?.warnings || data || [];

      return warnings.map((w: Record<string, unknown>) => {
        const lat = (w.lat || w.latitude || -25) as number;
        const lng = (w.lon || w.longitude || 134) as number;

        return {
          id: `au-floods:${w.id || w.identifier || Math.random().toString(36).slice(2)}`,
          source: this.id,
          sourceType: 'cap' as const,
          title: (w.title || w.headline || 'Flood Warning') as string,
          summary: (w.description || w.body || '') as string,
          category: 'flood' as const,
          subcategory: mapFloodType((w.title || w.type || '') as string),
          severity: normaliseSeverity(w.severity as string),
          state: (w.state || undefined) as AUState | undefined,
          region: (w.area || w.catchment) as string || undefined,
          latitude: lat,
          longitude: lng,
          geometry: w.polygon ? { type: 'Polygon', coordinates: w.polygon } as GeoJSON.Polygon : null,
          status: 'active' as const,
          startedAt: parseDate(w.issued || w.sent),
          updatedAt: parseDate(w.updated || w.issued),
          expiresAt: w.expiry ? parseDate(w.expiry) : undefined,
          tags: ['flood', (w.type || '') as string].filter(Boolean),
          canonicalUrl: (w.web || 'http://www.bom.gov.au/australia/flood/') as string,
          attribution: this.attribution,
          rawPayload: w,
        } satisfies AUEvent;
      });
    } catch (err) {
      console.warn('[AU:floods] fetch failed', err);
      return [];
    }
  }
}
