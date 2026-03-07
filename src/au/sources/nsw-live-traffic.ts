/**
 * NSW Live Traffic — Traffic Incidents
 *
 * Source: Transport for NSW Open Data (data.transport.nsw.gov.au)
 * Format: GeoJSON REST API
 * Auth: API key required (free registration)
 * Rate limit: Reasonable use
 * Attribution: "Contains transport data from Transport for NSW"
 * Licence: Creative Commons Attribution 4.0
 *
 * Provides real-time traffic incidents (crashes, roadworks, hazards, closures)
 * across NSW road network.
 */

import { BaseAUAdapter } from './base-adapter';
import type { AUEvent, AUEventCategory, AUState, AUSourceType, AUEventSubcategory } from '../types';
import { normaliseSeverity, parseDate } from '../types';

const TFNSW_INCIDENTS_URL = 'https://api.transport.nsw.gov.au/v1/live/hazards/incident/open';
const TFNSW_ROADWORKS_URL = 'https://api.transport.nsw.gov.au/v1/live/hazards/roadwork/open';

function mapSubcategory(mainCategory: string): AUEventSubcategory {
  const lc = (mainCategory || '').toLowerCase();
  if (lc.includes('crash') || lc.includes('accident')) return 'crash';
  if (lc.includes('roadwork') || lc.includes('construction')) return 'roadwork';
  if (lc.includes('congestion')) return 'congestion';
  if (lc.includes('closure') || lc.includes('closed')) return 'closure';
  return 'hazard';
}

export class NSWLiveTrafficAdapter extends BaseAUAdapter {
  id = 'nsw-livetraffic' as const;
  name = 'NSW Live Traffic';
  category: AUEventCategory = 'traffic-incident';
  states: AUState[] = ['NSW'];
  sourceType: AUSourceType = 'api';
  attribution = 'Contains transport data from Transport for NSW';
  refreshIntervalMs = 2 * 60 * 1000; // 2 minutes

  protected async fetchAndParse(): Promise<AUEvent[]> {
    const apiKey = (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_TFNSW_API_KEY : '') || '';
    if (!apiKey) {
      console.warn('[AU:nsw-livetraffic] No VITE_TFNSW_API_KEY configured');
      return [];
    }

    const headers = { Authorization: `apikey ${apiKey}`, Accept: 'application/json' };

    const [incidentRes, roadworkRes] = await Promise.allSettled([
      fetch(TFNSW_INCIDENTS_URL, { headers }),
      fetch(TFNSW_ROADWORKS_URL, { headers }),
    ]);

    const events: AUEvent[] = [];

    for (const res of [incidentRes, roadworkRes]) {
      if (res.status !== 'fulfilled' || !res.value.ok) continue;
      const data = await res.value.json();
      const features = data?.features || [];

      for (const f of features) {
        const props = f.properties || {};
        const coords = f.geometry?.coordinates;
        if (!coords) continue;

        // GeoJSON is [lng, lat]
        const lng = Array.isArray(coords[0]) ? coords[0][0] : coords[0];
        const lat = Array.isArray(coords[0]) ? coords[0][1] : coords[1];

        events.push({
          id: `nsw-livetraffic:${props.id || f.id || Math.random().toString(36).slice(2)}`,
          source: this.id,
          sourceType: 'api',
          title: props.headline || props.displayName || 'Traffic incident',
          summary: props.adviceA || props.otherAdvice || props.headline || '',
          category: 'traffic-incident',
          subcategory: mapSubcategory(props.mainCategory),
          severity: normaliseSeverity(props.impactSeverity || props.severity),
          state: 'NSW',
          region: props.roads?.[0]?.region || undefined,
          suburb: props.roads?.[0]?.suburb || props.suburb || undefined,
          latitude: lat,
          longitude: lng,
          geometry: f.geometry?.type === 'Point' ? null : f.geometry,
          imageUrl: undefined,
          cameraUrl: undefined,
          status: props.end ? 'resolved' : 'active',
          startedAt: parseDate(props.created || props.start),
          updatedAt: parseDate(props.lastUpdated || props.created),
          expiresAt: props.end ? parseDate(props.end) : undefined,
          tags: [props.mainCategory, props.subCategory].filter(Boolean) as string[],
          canonicalUrl: `https://www.livetraffic.com/desktop.html#incidentId=${props.id}`,
          attribution: this.attribution,
          rawPayload: props,
        });
      }
    }

    return events;
  }
}
