/**
 * Australia Monitor — Source Adapter Registry
 *
 * Creates and manages all AU source adapters. Used by the data-loader
 * to orchestrate fetching and the data-freshness tracker to monitor health.
 */

import type { AUSourceAdapter, AUEvent, AUEventCategory, AUState } from './types';
import { NSWLiveTrafficAdapter } from './sources/nsw-live-traffic';
import { NSWTrafficCamerasAdapter } from './sources/nsw-traffic-cameras';
import { QLDTrafficAdapter } from './sources/qld-traffic';
import { VICTrafficAdapter } from './sources/vic-traffic';
import { BOMWarningsAdapter } from './sources/bom-warnings';
import { BushfireAdapter } from './sources/bushfires';
import { GAEarthquakeAdapter } from './sources/ga-earthquakes';
import { FloodWarningsAdapter } from './sources/flood-warnings';
import { TransportDisruptionsAdapter } from './sources/transport-disruptions';

export interface AUSourceRegistry {
  adapters: AUSourceAdapter[];

  /** Fetch all sources in parallel, return merged events */
  fetchAll(): Promise<AUEvent[]>;

  /** Fetch only sources for a given category */
  fetchByCategory(category: AUEventCategory): Promise<AUEvent[]>;

  /** Fetch only sources covering a specific state */
  fetchByState(state: AUState): Promise<AUEvent[]>;

  /** Get health status for all sources */
  getHealth(): Record<string, { status: string; itemCount: number; lastError: string | null }>;
}

export function createAUSourceRegistry(): AUSourceRegistry {
  const adapters: AUSourceAdapter[] = [
    new NSWLiveTrafficAdapter(),
    new NSWTrafficCamerasAdapter(),
    new QLDTrafficAdapter(),
    new VICTrafficAdapter(),
    new BOMWarningsAdapter(),
    new BushfireAdapter(),
    new GAEarthquakeAdapter(),
    new FloodWarningsAdapter(),
    new TransportDisruptionsAdapter(),
  ];

  return {
    adapters,

    async fetchAll(): Promise<AUEvent[]> {
      const results = await Promise.allSettled(adapters.map(a => a.fetch()));
      return results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
    },

    async fetchByCategory(category: AUEventCategory): Promise<AUEvent[]> {
      const matching = adapters.filter(a => a.category === category);
      const results = await Promise.allSettled(matching.map(a => a.fetch()));
      return results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
    },

    async fetchByState(state: AUState): Promise<AUEvent[]> {
      const matching = adapters.filter(a => a.states.includes(state));
      const results = await Promise.allSettled(matching.map(a => a.fetch()));
      return results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
    },

    getHealth() {
      const health: Record<string, { status: string; itemCount: number; lastError: string | null }> = {};
      for (const a of adapters) {
        const h = a.health;
        let status = 'ok';
        if (h.consecutiveFailures > 0) status = 'degraded';
        if (h.consecutiveFailures >= 5) status = 'circuit-open';
        if (!h.lastSuccess) status = 'no-data';

        health[a.id] = {
          status,
          itemCount: h.itemCount,
          lastError: h.lastError,
        };
      }
      return health;
    },
  };
}
