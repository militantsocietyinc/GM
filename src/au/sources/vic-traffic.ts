/**
 * Victoria Traffic — VicRoads / Department of Transport
 *
 * Source: VicTraffic / data.vic.gov.au
 * Format: JSON/GeoJSON
 * Attribution: "© State of Victoria (Department of Transport and Planning)"
 * Licence: Creative Commons Attribution 4.0
 */

import { BaseAUAdapter } from './base-adapter';
import type { AUEvent, AUEventCategory, AUState, AUSourceType } from '../types';
import { normaliseSeverity, parseDate } from '../types';

// VicTraffic incidents feed
const VIC_INCIDENTS_URL = 'https://traffic.vicroads.vic.gov.au/api/events';

export class VICTrafficAdapter extends BaseAUAdapter {
  id = 'vic-traffic' as const;
  name = 'VIC Traffic';
  category: AUEventCategory = 'traffic-incident';
  states: AUState[] = ['VIC'];
  sourceType: AUSourceType = 'api';
  attribution = '© State of Victoria (Department of Transport and Planning)';
  refreshIntervalMs = 3 * 60 * 1000;

  protected async fetchAndParse(): Promise<AUEvent[]> {
    const res = await fetch(VIC_INCIDENTS_URL, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const items = Array.isArray(data) ? data : data?.events || data?.features || [];

    return items.map((item: Record<string, unknown>) => {
      const props = (item.properties || item) as Record<string, unknown>;
      const lat = (props.latitude || props.lat || -37.8) as number;
      const lng = (props.longitude || props.lng || 144.9) as number;

      return {
        id: `vic-traffic:${props.id || Math.random().toString(36).slice(2)}`,
        source: this.id,
        sourceType: 'api' as const,
        title: (props.title || props.description || 'VIC Traffic Event') as string,
        summary: (props.detail || props.description || '') as string,
        category: 'traffic-incident' as const,
        severity: normaliseSeverity(props.severity as string),
        state: 'VIC' as const,
        suburb: props.suburb as string || undefined,
        latitude: lat,
        longitude: lng,
        status: 'active' as const,
        startedAt: parseDate(props.startTime || props.created),
        updatedAt: parseDate(props.lastUpdated || props.startTime),
        tags: [(props.type || '') as string].filter(Boolean),
        attribution: this.attribution,
        rawPayload: props,
      } satisfies AUEvent;
    });
  }
}
