/**
 * Australia Monitor — Main Barrel Export
 *
 * All AU-specific modules re-exported from here.
 */

// Types
export * from './types';

// Region presets
export * from './regions';

// Source adapters
export {
  NSWLiveTrafficAdapter,
  NSWTrafficCamerasAdapter,
  QLDTrafficAdapter,
  VICTrafficAdapter,
  BOMWarningsAdapter,
  BushfireAdapter,
  GAEarthquakeAdapter,
  FloodWarningsAdapter,
  TransportDisruptionsAdapter,
  AUNewsAdapter,
} from './sources';

// Source registry (convenience for data-loader)
export { createAUSourceRegistry } from './source-registry';
