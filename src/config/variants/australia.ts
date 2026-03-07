// Australia variant — australiamonitor.app
import type { PanelConfig, MapLayers } from '@/types';
import type { VariantConfig } from './base';

// Re-export base config
export * from './base';

// Re-export AU-specific data
export { AU_REGIONS, findRegion, regionsForState } from '@/au/regions';
export { AU_NEWS_FEEDS, getAllAUFeeds, AU_SOURCE_TIERS } from '@/au/sources/au-news';

// Panel configuration for Australia monitoring
export const DEFAULT_PANELS: Record<string, PanelConfig> = {
  map: { name: 'Australia Map', enabled: true, priority: 1 },
  'live-news': { name: 'AU Headlines', enabled: true, priority: 1 },
  'au-summary': { name: 'Australia Summary', enabled: true, priority: 1 },
  insights: { name: 'AI Insights', enabled: true, priority: 1 },
  'traffic-incidents': { name: 'Traffic Incidents', enabled: true, priority: 1 },
  'traffic-cameras': { name: 'Traffic Cameras', enabled: true, priority: 1 },
  bushfires: { name: 'Bushfires', enabled: true, priority: 1 },
  weather: { name: 'Weather Warnings', enabled: true, priority: 1 },
  floods: { name: 'Flood Warnings', enabled: true, priority: 1 },
  earthquakes: { name: 'Earthquakes', enabled: true, priority: 1 },
  transport: { name: 'Transport Disruptions', enabled: true, priority: 1 },
  'au-national': { name: 'National News', enabled: true, priority: 1 },
  'au-nsw': { name: 'NSW', enabled: true, priority: 1 },
  'au-vic': { name: 'Victoria', enabled: true, priority: 1 },
  'au-qld': { name: 'Queensland', enabled: true, priority: 1 },
  'au-wa': { name: 'Western Australia', enabled: true, priority: 2 },
  'au-sa': { name: 'South Australia', enabled: true, priority: 2 },
  'au-business': { name: 'Business & Economy', enabled: true, priority: 2 },
  markets: { name: 'ASX / Markets', enabled: true, priority: 2 },
  commodities: { name: 'Commodities', enabled: true, priority: 2 },
  'au-tech': { name: 'AU Tech', enabled: true, priority: 2 },
  'au-politics': { name: 'AU Politics', enabled: true, priority: 2 },
  'satellite-fires': { name: 'Satellite Fires', enabled: true, priority: 2 },
  'open-cameras': { name: 'Public Cameras', enabled: false, priority: 2 },
  monitors: { name: 'My Monitors', enabled: true, priority: 2 },
};

// Map layers for Australia view
// Reuses existing MapLayers interface — AU-specific layers map to existing keys
// where possible, with AU source adapters providing the data.
export const DEFAULT_MAP_LAYERS: MapLayers = {
  // -- Enabled for Australia variant --
  weather: true,          // BOM weather warnings
  natural: true,          // Earthquakes + natural events
  fires: true,            // Bushfires (NASA FIRMS + state feeds)
  climate: true,          // Climate anomalies
  outages: true,          // Internet/power outages
  // Existing layers that work for AU
  protests: false,
  conflicts: false,
  hotspots: false,

  // -- Global layers (mostly disabled) --
  bases: false,
  cables: false,
  pipelines: false,
  ais: false,
  nuclear: false,
  irradiators: false,
  sanctions: false,
  economic: false,
  waterways: false,
  cyberThreats: false,
  datacenters: false,
  flights: false,
  military: false,
  spaceports: false,
  minerals: false,
  ucdpEvents: false,
  displacement: false,
  startupHubs: false,
  cloudRegions: false,
  accelerators: false,
  techHQs: false,
  techEvents: false,
  stockExchanges: false,
  financialCenters: false,
  centralBanks: false,
  commodityHubs: false,
  gulfInvestments: false,
  positiveEvents: false,
  kindness: false,
  happiness: false,
  speciesRecovery: false,
  renewableInstallations: false,
  tradeRoutes: false,
  iranAttacks: false,
  gpsJamming: false,
  ciiChoropleth: false,
  dayNight: false,
  miningSites: false,
  processingPlants: false,
  commodityPorts: false,
};

// Mobile-specific defaults for Australia
export const MOBILE_DEFAULT_MAP_LAYERS: MapLayers = {
  ...DEFAULT_MAP_LAYERS,
  climate: false,   // save bandwidth on mobile
  fires: true,      // keep fires — critical in AU
  weather: true,    // keep weather
  natural: true,    // keep earthquakes
  outages: false,   // hide on mobile
};

export const VARIANT_CONFIG: VariantConfig = {
  name: 'australia',
  description: 'Australia-focused live monitoring dashboard',
  panels: DEFAULT_PANELS,
  mapLayers: DEFAULT_MAP_LAYERS,
  mobileMapLayers: MOBILE_DEFAULT_MAP_LAYERS,
};

// Australia default map view
export const AU_DEFAULT_MAP = {
  center: [134.0, -25.5] as [number, number],
  zoom: 4,
  minZoom: 3,
  maxBounds: [[105, -50], [165, -5]] as [[number, number], [number, number]],
};
