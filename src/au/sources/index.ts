/**
 * Australia Monitor — Source Adapter Registry
 *
 * Central registry for all AU data source adapters.
 * Each adapter implements AUSourceAdapter and maps raw data to AUEvent[].
 */

export { NSWLiveTrafficAdapter } from './nsw-live-traffic';
export { NSWTrafficCamerasAdapter } from './nsw-traffic-cameras';
export { QLDTrafficAdapter } from './qld-traffic';
export { VICTrafficAdapter } from './vic-traffic';
export { BOMWarningsAdapter } from './bom-warnings';
export { BushfireAdapter } from './bushfires';
export { GAEarthquakeAdapter } from './ga-earthquakes';
export { FloodWarningsAdapter } from './flood-warnings';
export { TransportDisruptionsAdapter } from './transport-disruptions';
export { AUNewsAdapter } from './au-news';

// Re-export types
export type { AUSourceAdapter, AUSourceHealth } from '../types';
