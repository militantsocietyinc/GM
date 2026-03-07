/**
 * Queensland Traffic — Incidents & Cameras
 *
 * Source: Queensland Department of Transport and Main Roads (DTMR)
 * Format: GeoJSON / JSON API (data.qld.gov.au / qldtraffic.qld.gov.au)
 * Auth: API key for some endpoints; open data for others
 * Attribution: "© State of Queensland (Department of Transport and Main Roads)"
 * Licence: Creative Commons Attribution 4.0
 *
 * Provides traffic incidents and camera feeds across QLD.
 */

import { BaseAUAdapter } from './base-adapter';
import type { AUEvent, AUEventCategory, AUState, AUSourceType } from '../types';
import { normaliseSeverity, parseDate } from '../types';

// QLD Traffic public API
const QLD_EVENTS_URL = 'https://api.qldtraffic.qld.gov.au/v2/events';

export class QLDTrafficAdapter extends BaseAUAdapter {
  id = 'qld-traffic' as const;
  name = 'QLD Traffic';
  category: AUEventCategory = 'traffic-incident';
  states: AUState[] = ['QLD'];
  sourceType: AUSourceType = 'api';
  attribution = '© State of Queensland (Department of Transport and Main Roads)';
  refreshIntervalMs = 3 * 60 * 1000; // 3 minutes

  protected async fetchAndParse(): Promise<AUEvent[]> {
    const apiKey = (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_QLD_TRAFFIC_API_KEY : '') || '';
    if (!apiKey) {
      console.warn('[AU:qld-traffic] No VITE_QLD_TRAFFIC_API_KEY configured');
      return [];
    }

    const res = await fetch(QLD_EVENTS_URL, {
      headers: { 'x-api-key': apiKey, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const features = data?.features || data || [];

    return features.map((f: Record<string, unknown>) => {
      const props = (f.properties || f) as Record<string, unknown>;
      const geom = f.geometry as { coordinates?: number[] } | undefined;
      const coords = geom?.coordinates || [];
      const lng = coords[0] as number || 153.0;
      const lat = coords[1] as number || -27.5;

      return {
        id: `qld-traffic:${props.event_id || props.id || Math.random().toString(36).slice(2)}`,
        source: this.id,
        sourceType: 'api' as const,
        title: (props.description || props.event_type || 'QLD Traffic Event') as string,
        summary: (props.detail || props.description || '') as string,
        category: 'traffic-incident' as const,
        subcategory: undefined,
        severity: normaliseSeverity(props.severity as string),
        state: 'QLD' as const,
        region: props.district as string || undefined,
        suburb: props.suburb as string || undefined,
        latitude: lat,
        longitude: lng,
        geometry: geom?.coordinates ? null : undefined,
        status: 'active' as const,
        startedAt: parseDate(props.start_date || props.created),
        updatedAt: parseDate(props.last_updated || props.start_date),
        tags: [(props.event_type || '') as string].filter(Boolean),
        canonicalUrl: `https://qldtraffic.qld.gov.au/`,
        attribution: this.attribution,
        rawPayload: props,
      } satisfies AUEvent;
    });
  }
}
