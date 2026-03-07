/**
 * NSW Traffic Cameras
 *
 * Source: Transport for NSW / Roads and Maritime Services
 * Format: JSON API
 * Auth: API key required (free registration)
 * Attribution: "Contains transport data from Transport for NSW"
 * Licence: Creative Commons Attribution 4.0
 *
 * ~350+ traffic cameras across the NSW road network.
 * Returns camera metadata + latest snapshot URLs.
 */

import { BaseAUAdapter } from './base-adapter';
import type { AUEvent, AUCamera, AUEventCategory, AUState, AUSourceType } from '../types';
import { parseDate } from '../types';

const TFNSW_CAMERAS_URL = 'https://api.transport.nsw.gov.au/v1/live/cameras';

export class NSWTrafficCamerasAdapter extends BaseAUAdapter {
  id = 'nsw-traffic-cameras' as const;
  name = 'NSW Traffic Cameras';
  category: AUEventCategory = 'traffic-camera';
  states: AUState[] = ['NSW'];
  sourceType: AUSourceType = 'api';
  attribution = 'Contains transport data from Transport for NSW';
  refreshIntervalMs = 5 * 60 * 1000; // 5 minutes (images update every 1-5 min)

  /** Also expose as structured camera data */
  cameras: AUCamera[] = [];

  protected async fetchAndParse(): Promise<AUEvent[]> {
    const apiKey = (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_TFNSW_API_KEY : '') || '';
    if (!apiKey) {
      console.warn('[AU:nsw-traffic-cameras] No VITE_TFNSW_API_KEY configured');
      return [];
    }

    const res = await fetch(TFNSW_CAMERAS_URL, {
      headers: { Authorization: `apikey ${apiKey}`, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const features = data?.features || [];
    const events: AUEvent[] = [];
    this.cameras = [];

    for (const f of features) {
      const props = f.properties || {};
      const coords = f.geometry?.coordinates;
      if (!coords) continue;

      const lng = coords[0];
      const lat = coords[1];
      const imageUrl = props.href || props.imageUrl || '';

      const camera: AUCamera = {
        id: `nsw-cam:${props.id || f.id}`,
        source: this.id,
        title: props.title || props.displayName || 'NSW Camera',
        state: 'NSW',
        region: props.region || undefined,
        latitude: lat,
        longitude: lng,
        imageUrl,
        refreshIntervalMs: 60_000,
        direction: props.direction || undefined,
        roadName: props.road || undefined,
        attribution: this.attribution,
        lastUpdated: new Date(),
        type: 'traffic',
      };
      this.cameras.push(camera);

      events.push({
        id: `nsw-traffic-cameras:${props.id || f.id}`,
        source: this.id,
        sourceType: 'api',
        title: props.title || props.displayName || 'Traffic Camera',
        summary: `Traffic camera on ${props.road || 'road'} — ${props.direction || ''}`.trim(),
        category: 'traffic-camera',
        severity: 'unknown',
        state: 'NSW',
        region: props.region || undefined,
        latitude: lat,
        longitude: lng,
        imageUrl,
        status: 'active',
        startedAt: new Date(),
        updatedAt: new Date(),
        tags: ['camera', 'traffic', props.road].filter(Boolean) as string[],
        attribution: this.attribution,
        rawPayload: props,
      });
    }

    return events;
  }
}
