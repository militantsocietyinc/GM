/**
 * Australia Monitor — Region Presets
 *
 * Predefined map views for Australia, states, and key cities.
 * Used for the region filter dropdown and deep-link URLs.
 */

import type { AURegionPreset } from './types';

export const AU_REGIONS: AURegionPreset[] = [
  // ── Country ──────────────────────────────────────────────
  {
    id: 'australia',
    label: 'Australia',
    center: [134.0, -25.5],
    zoom: 4,
    bbox: [112.0, -44.0, 154.0, -10.0],
  },

  // ── States & Territories ────────────────────────────────
  {
    id: 'nsw',
    label: 'New South Wales',
    center: [147.0, -32.5],
    zoom: 6,
    bbox: [141.0, -37.5, 153.7, -28.1],
    states: ['NSW'],
  },
  {
    id: 'vic',
    label: 'Victoria',
    center: [145.0, -37.0],
    zoom: 7,
    bbox: [140.9, -39.2, 150.0, -33.9],
    states: ['VIC'],
  },
  {
    id: 'qld',
    label: 'Queensland',
    center: [146.0, -22.0],
    zoom: 5,
    bbox: [137.9, -29.2, 153.6, -10.0],
    states: ['QLD'],
  },
  {
    id: 'wa',
    label: 'Western Australia',
    center: [122.0, -25.0],
    zoom: 5,
    bbox: [112.0, -35.2, 129.0, -13.6],
    states: ['WA'],
  },
  {
    id: 'sa',
    label: 'South Australia',
    center: [136.5, -30.0],
    zoom: 6,
    bbox: [129.0, -38.1, 141.0, -26.0],
    states: ['SA'],
  },
  {
    id: 'tas',
    label: 'Tasmania',
    center: [146.5, -42.0],
    zoom: 7,
    bbox: [143.8, -43.7, 148.5, -39.5],
    states: ['TAS'],
  },
  {
    id: 'nt',
    label: 'Northern Territory',
    center: [133.5, -19.5],
    zoom: 6,
    bbox: [129.0, -26.0, 138.0, -10.9],
    states: ['NT'],
  },
  {
    id: 'act',
    label: 'ACT',
    center: [149.13, -35.3],
    zoom: 11,
    bbox: [148.7, -35.9, 149.4, -35.1],
    states: ['ACT'],
  },

  // ── Major Cities ────────────────────────────────────────
  {
    id: 'sydney',
    label: 'Sydney',
    center: [151.2, -33.87],
    zoom: 11,
    bbox: [150.5, -34.2, 151.5, -33.4],
    states: ['NSW'],
  },
  {
    id: 'melbourne',
    label: 'Melbourne',
    center: [144.96, -37.81],
    zoom: 11,
    bbox: [144.5, -38.1, 145.5, -37.5],
    states: ['VIC'],
  },
  {
    id: 'brisbane',
    label: 'Brisbane',
    center: [153.02, -27.47],
    zoom: 11,
    bbox: [152.7, -27.8, 153.4, -27.1],
    states: ['QLD'],
  },
  {
    id: 'perth',
    label: 'Perth',
    center: [115.86, -31.95],
    zoom: 11,
    bbox: [115.5, -32.3, 116.2, -31.6],
    states: ['WA'],
  },
  {
    id: 'adelaide',
    label: 'Adelaide',
    center: [138.6, -34.93],
    zoom: 11,
    bbox: [138.3, -35.3, 138.9, -34.6],
    states: ['SA'],
  },
  {
    id: 'hobart',
    label: 'Hobart',
    center: [147.33, -42.88],
    zoom: 12,
    bbox: [147.0, -43.1, 147.6, -42.6],
    states: ['TAS'],
  },
  {
    id: 'darwin',
    label: 'Darwin',
    center: [130.84, -12.46],
    zoom: 12,
    bbox: [130.6, -12.7, 131.1, -12.2],
    states: ['NT'],
  },
  {
    id: 'canberra',
    label: 'Canberra',
    center: [149.13, -35.28],
    zoom: 12,
    bbox: [148.9, -35.5, 149.3, -35.1],
    states: ['ACT'],
  },

  // ── Key Regions ────────────────────────────────────────
  {
    id: 'gold-coast',
    label: 'Gold Coast',
    center: [153.4, -28.0],
    zoom: 11,
    bbox: [153.1, -28.3, 153.6, -27.7],
    states: ['QLD'],
  },
  {
    id: 'sunshine-coast',
    label: 'Sunshine Coast',
    center: [153.0, -26.65],
    zoom: 11,
    bbox: [152.7, -27.0, 153.2, -26.3],
    states: ['QLD'],
  },
  {
    id: 'newcastle',
    label: 'Newcastle',
    center: [151.78, -32.93],
    zoom: 11,
    bbox: [151.4, -33.2, 152.1, -32.6],
    states: ['NSW'],
  },
  {
    id: 'wollongong',
    label: 'Wollongong',
    center: [150.89, -34.43],
    zoom: 11,
    bbox: [150.6, -34.7, 151.2, -34.1],
    states: ['NSW'],
  },
  {
    id: 'geelong',
    label: 'Geelong',
    center: [144.36, -38.15],
    zoom: 11,
    bbox: [144.1, -38.4, 144.6, -37.9],
    states: ['VIC'],
  },
];

export function findRegion(id: string): AURegionPreset | undefined {
  return AU_REGIONS.find(r => r.id === id);
}

export function regionsForState(state: string): AURegionPreset[] {
  return AU_REGIONS.filter(r => r.states?.includes(state as never));
}
