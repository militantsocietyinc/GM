/**
 * Bushfire Feeds — Multi-State
 *
 * Aggregates fire incident data from:
 * - NSW Rural Fire Service (fires.nsw.gov.au) — GeoJSON
 * - CFA Victoria (emergency.vic.gov.au) — GeoJSON
 * - QFES Queensland (qfes.qld.gov.au) — GeoJSON/RSS
 * - DFES Western Australia (dfes.wa.gov.au) — GeoJSON
 * - CFS South Australia (cfs.sa.gov.au) — GeoJSON
 * - TFS Tasmania (fire.tas.gov.au) — GeoJSON
 * - NT PFES (pfes.nt.gov.au) — RSS
 * - ESA ACT (esa.act.gov.au) — GeoJSON
 *
 * Also augmented by NASA FIRMS satellite hotspots (already in worldmonitor).
 *
 * Integration difficulty: Easy-Medium
 * - Most state agencies publish GeoJSON feeds
 * - Formats differ slightly per state
 * - All publicly available, no auth needed
 * - Attribution required per state agency
 */

import { BaseAUAdapter } from './base-adapter';
import type { AUEvent, AUEventCategory, AUState, AUSourceType, AUEventSubcategory } from '../types';
import { normaliseSeverity, parseDate } from '../types';

interface FireFeed {
  state: AUState;
  url: string;
  name: string;
  attribution: string;
}

const FIRE_FEEDS: FireFeed[] = [
  {
    state: 'NSW',
    url: 'https://feeds.nsw.gov.au/data/major-fire-update.json',
    name: 'NSW RFS',
    attribution: '© NSW Rural Fire Service',
  },
  {
    state: 'VIC',
    url: 'https://emergency.vic.gov.au/public/events.json',
    name: 'VIC Emergency',
    attribution: '© Emergency Management Victoria',
  },
  {
    state: 'QLD',
    url: 'https://www.qfes.qld.gov.au/data/alerts.json',
    name: 'QFES',
    attribution: '© Queensland Fire and Emergency Services',
  },
  {
    state: 'SA',
    url: 'https://data.eso.sa.gov.au/prod/cfs/criimson/cfs_current_incidents.json',
    name: 'SA CFS',
    attribution: '© SA Country Fire Service',
  },
  {
    state: 'WA',
    url: 'https://www.emergency.wa.gov.au/data/message.json',
    name: 'DFES WA',
    attribution: '© Department of Fire and Emergency Services WA',
  },
  {
    state: 'TAS',
    url: 'https://www.fire.tas.gov.au/Show?pageId=colGMapBushfires',
    name: 'TFS Tasmania',
    attribution: '© Tasmania Fire Service',
  },
];

function mapFireStatus(status: string): AUEventSubcategory {
  const lc = (status || '').toLowerCase();
  if (lc.includes('out of control') || lc.includes('emergency')) return 'out-of-control';
  if (lc.includes('being controlled') || lc.includes('watch and act')) return 'being-controlled';
  if (lc.includes('under control') || lc.includes('advice')) return 'under-control';
  if (lc.includes('planned') || lc.includes('burn')) return 'planned-burn';
  return 'other';
}

export class BushfireAdapter extends BaseAUAdapter {
  id = 'au-bushfires' as const;
  name = 'Australian Bushfires';
  category: AUEventCategory = 'bushfire';
  states: AUState[] = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'];
  sourceType: AUSourceType = 'geojson';
  attribution = 'Multi-agency Australian fire services';
  refreshIntervalMs = 3 * 60 * 1000; // 3 minutes

  protected async fetchAndParse(): Promise<AUEvent[]> {
    // For MVP: fetch NSW RFS which has the best-documented public API
    // Other states will be added incrementally via the proxy API
    const proxyUrl = `/api/au/bushfires`;

    try {
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const features = data?.features || data?.incidents || data || [];

      return features.map((f: Record<string, unknown>) => {
        const props = (f.properties || f) as Record<string, unknown>;
        const geom = f.geometry as { coordinates?: unknown } | undefined;
        let lat = -33.0;
        let lng = 151.0;

        if (geom?.coordinates) {
          const coords = geom.coordinates as number[] | number[][];
          if (typeof coords[0] === 'number') {
            lng = coords[0] as number;
            lat = coords[1] as number;
          }
        }

        // Centroid from props as fallback
        if (props.latitude) lat = props.latitude as number;
        if (props.longitude) lng = props.longitude as number;

        const alertLevel = (props.alert_level || props.category || props.status || '') as string;

        return {
          id: `au-bushfires:${props.id || props.guid || Math.random().toString(36).slice(2)}`,
          source: this.id,
          sourceType: 'geojson' as const,
          title: (props.title || props.name || props.description || 'Bushfire') as string,
          summary: (props.description || props.content || '') as string,
          category: 'bushfire' as const,
          subcategory: mapFireStatus(alertLevel),
          severity: normaliseSeverity(alertLevel),
          state: (props.state || 'NSW') as AUState,
          region: (props.lga || props.council_area || props.region) as string || undefined,
          suburb: (props.location || props.suburb) as string || undefined,
          latitude: lat,
          longitude: lng,
          geometry: geom as GeoJSON.Geometry || null,
          imageUrl: (props.image || props.media) as string || undefined,
          status: alertLevel.toLowerCase().includes('under control') ? 'resolved' : 'active',
          startedAt: parseDate(props.pubDate || props.created || props.start),
          updatedAt: parseDate(props.updated || props.pubDate),
          tags: ['bushfire', alertLevel].filter(Boolean),
          canonicalUrl: (props.link || props.url) as string || undefined,
          attribution: this.attribution,
          rawPayload: props,
        } satisfies AUEvent;
      });
    } catch (err) {
      console.warn('[AU:bushfires] fetch failed', err);
      return [];
    }
  }
}

export { FIRE_FEEDS };
