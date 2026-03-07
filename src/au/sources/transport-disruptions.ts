/**
 * Transport Disruptions — Public Transit
 *
 * Aggregates disruption feeds from state transit agencies:
 * - Transport for NSW (GTFS-RT alerts)
 * - PTV Victoria (GTFS-RT alerts)
 * - TransLink QLD
 * - Transperth WA
 * - Adelaide Metro SA
 *
 * Integration difficulty: Medium
 * - GTFS-RT is a standard protobuf format (reuse proto/ definitions)
 * - Each state has different auth requirements
 * - Some provide JSON alternatives
 *
 * For MVP: Focus on NSW and VIC which have the best-documented APIs.
 */

import { BaseAUAdapter } from './base-adapter';
import type { AUEvent, AUEventCategory, AUState, AUSourceType, AUEventSubcategory } from '../types';
import { normaliseSeverity, parseDate } from '../types';

function mapTransportType(routeType: string | number): AUEventSubcategory {
  const t = String(routeType).toLowerCase();
  if (t === '0' || t.includes('tram') || t.includes('light rail')) return 'tram-delay';
  if (t === '1' || t.includes('metro') || t.includes('subway')) return 'train-delay';
  if (t === '2' || t.includes('rail') || t.includes('train')) return 'train-delay';
  if (t === '3' || t.includes('bus')) return 'bus-delay';
  if (t === '4' || t.includes('ferry')) return 'ferry-delay';
  if (t.includes('track') || t.includes('work')) return 'track-work';
  if (t.includes('cancel')) return 'train-cancellation';
  return 'other';
}

export class TransportDisruptionsAdapter extends BaseAUAdapter {
  id = 'au-transport' as const;
  name = 'AU Transport Disruptions';
  category: AUEventCategory = 'transport-disruption';
  states: AUState[] = ['NSW', 'VIC', 'QLD'];
  sourceType: AUSourceType = 'api';
  attribution = 'Multiple state transit agencies';
  refreshIntervalMs = 3 * 60 * 1000;

  protected async fetchAndParse(): Promise<AUEvent[]> {
    const proxyUrl = `/api/au/transport`;

    try {
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const alerts = data?.alerts || data || [];

      return alerts.map((a: Record<string, unknown>) => {
        const lat = (a.lat || a.latitude || -33.8) as number;
        const lng = (a.lon || a.longitude || 151.2) as number;

        return {
          id: `au-transport:${a.id || a.alert_id || Math.random().toString(36).slice(2)}`,
          source: this.id,
          sourceType: 'api' as const,
          title: (a.header || a.title || 'Transport Disruption') as string,
          summary: (a.description || a.body || '') as string,
          category: 'transport-disruption' as const,
          subcategory: mapTransportType((a.route_type || a.type || '') as string),
          severity: normaliseSeverity(a.severity as string),
          state: (a.state || 'NSW') as AUState,
          region: (a.route_name || a.line) as string || undefined,
          latitude: lat,
          longitude: lng,
          status: (a.active === false ? 'resolved' : 'active') as const,
          startedAt: parseDate(a.start || a.created),
          updatedAt: parseDate(a.updated || a.start),
          expiresAt: a.end ? parseDate(a.end) : undefined,
          tags: ['transport', (a.route_type || '') as string, (a.route_name || '') as string].filter(Boolean),
          canonicalUrl: (a.url || a.link) as string || undefined,
          attribution: this.attribution,
          rawPayload: a,
        } satisfies AUEvent;
      });
    } catch (err) {
      console.warn('[AU:transport] fetch failed', err);
      return [];
    }
  }
}
