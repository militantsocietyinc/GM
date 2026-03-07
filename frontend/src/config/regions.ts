export interface IslandGroup {
  id: string;
  name: string;
  center: { lat: number; lon: number };
  zoom: number;
  regions: string[];
}

export const ISLAND_GROUPS: IslandGroup[] = [
  {
    id: "luzon",
    name: "Luzon",
    center: { lat: 16.0, lon: 121.0 },
    zoom: 7,
    regions: ["NCR", "CAR", "Region I", "Region II", "Region III", "Region IV-A", "Region IV-B", "Region V"],
  },
  {
    id: "visayas",
    name: "Visayas",
    center: { lat: 10.7, lon: 124.0 },
    zoom: 8,
    regions: ["Region VI", "Region VII", "Region VIII"],
  },
  {
    id: "mindanao",
    name: "Mindanao",
    center: { lat: 7.5, lon: 126.0 },
    zoom: 8,
    regions: ["Region IX", "Region X", "Region XI", "Region XII", "Region XIII", "BARMM"],
  },
];
