import { PH_CENTER, PH_DEFAULT_ZOOM, PH_BOUNDS, PH_EEZ_BOUNDS } from "@bantay-pilipinas/shared";

export { PH_CENTER, PH_DEFAULT_ZOOM, PH_BOUNDS, PH_EEZ_BOUNDS };

export interface WPSFeature {
  id: string;
  name: string;
  filipinoName: string;
  lat: number;
  lon: number;
  status: string;
}

export const WPS_FEATURES: WPSFeature[] = [
  { id: "scarborough", name: "Scarborough Shoal", filipinoName: "Bajo de Masinloc", lat: 15.15, lon: 117.76, status: "Chinese-controlled since 2012" },
  { id: "ayungin", name: "Second Thomas Shoal", filipinoName: "Ayungin Shoal", lat: 9.75, lon: 115.87, status: "PH-garrisoned (BRP Sierra Madre)" },
  { id: "pagasa", name: "Thitu Island", filipinoName: "Pag-asa Island", lat: 11.05, lon: 114.28, status: "PH-occupied, civilian settlement" },
  { id: "panganiban", name: "Mischief Reef", filipinoName: "Panganiban Reef", lat: 9.9, lon: 115.53, status: "Chinese artificial island" },
  { id: "recto", name: "Reed Bank", filipinoName: "Recto Bank", lat: 11.45, lon: 116.85, status: "PH EEZ, oil/gas potential" },
  { id: "kalayaan", name: "Spratly Islands", filipinoName: "Kalayaan Group", lat: 10.0, lon: 115.0, status: "Multiple claimants" },
];

export interface EDCASite {
  id: string;
  name: string;
  location: string;
  lat: number;
  lon: number;
  branch: string;
}

export const EDCA_SITES: EDCASite[] = [
  { id: "basa", name: "Basa Air Base", location: "Pampanga", lat: 14.98, lon: 120.49, branch: "PAF" },
  { id: "mactan", name: "Mactan-Benito Ebuen Air Base", location: "Cebu", lat: 10.31, lon: 123.98, branch: "PAF" },
  { id: "lumbia", name: "Lumbia Air Base", location: "Cagayan de Oro", lat: 8.61, lon: 124.63, branch: "PAF" },
  { id: "antonio-bautista", name: "Antonio Bautista Air Base", location: "Palawan", lat: 9.74, lon: 118.76, branch: "PAF" },
  { id: "fort-magsaysay", name: "Fort Magsaysay", location: "Nueva Ecija", lat: 15.43, lon: 121.1, branch: "PA" },
  { id: "camilo-osias", name: "Camilo Osias Naval Base", location: "Santa Ana, Cagayan", lat: 18.46, lon: 122.14, branch: "PN" },
  { id: "balabac", name: "Balabac Island", location: "Palawan", lat: 7.98, lon: 117.05, branch: "PN" },
  { id: "lal-lo", name: "Lal-lo Airport", location: "Cagayan", lat: 18.18, lon: 121.74, branch: "PAF" },
  { id: "subic", name: "Subic Bay", location: "Zambales", lat: 14.79, lon: 120.27, branch: "PN" },
];

export interface VolcanoEntry {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export const ACTIVE_VOLCANOES: VolcanoEntry[] = [
  { id: "mayon", name: "Mayon", lat: 13.257, lon: 123.685 },
  { id: "taal", name: "Taal", lat: 14.002, lon: 120.993 },
  { id: "pinatubo", name: "Pinatubo", lat: 15.13, lon: 120.35 },
  { id: "kanlaon", name: "Kanlaon", lat: 10.412, lon: 123.132 },
  { id: "bulusan", name: "Bulusan", lat: 12.77, lon: 124.05 },
  { id: "hibok-hibok", name: "Hibok-Hibok", lat: 9.203, lon: 124.673 },
];

export const FAULT_LINES = [
  { id: "valley-fault", name: "Valley Fault System", region: "Metro Manila / Rizal / Laguna / Cavite / Bulacan" },
  { id: "philippine-fault", name: "Philippine Fault Zone", region: "Luzon to Mindanao (1200km)" },
  { id: "manila-trench", name: "Manila Trench", region: "West Luzon offshore" },
  { id: "philippine-trench", name: "Philippine Trench", region: "East Mindanao offshore (10,540m)" },
];

export const REGION_PRESETS = {
  wps: { lat: 12.0, lon: 116.0, zoom: 7 },
  ncr: { lat: 14.5995, lon: 120.9842, zoom: 11 },
  visayas: { lat: 10.7, lon: 124.0, zoom: 8 },
  mindanao: { lat: 7.5, lon: 126.0, zoom: 8 },
  luzon: { lat: 16.0, lon: 121.0, zoom: 7 },
  barmm: { lat: 6.95, lon: 124.25, zoom: 8 },
};
