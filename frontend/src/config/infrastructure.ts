export interface SubmarineCable {
  id: string;
  name: string;
  landingPoints: { name: string; lat: number; lon: number }[];
}

export const SUBMARINE_CABLES: SubmarineCable[] = [
  {
    id: "aag",
    name: "Asia-America Gateway",
    landingPoints: [{ name: "Nasugbu, Batangas", lat: 14.07, lon: 120.63 }],
  },
  {
    id: "sea-us",
    name: "Southeast Asia-United States (SEA-US)",
    landingPoints: [{ name: "Davao City", lat: 7.07, lon: 125.61 }],
  },
  {
    id: "jupiter",
    name: "Jupiter Cable System",
    landingPoints: [{ name: "Daet, Camarines Norte", lat: 14.11, lon: 122.96 }],
  },
  {
    id: "apricot",
    name: "APRICOT",
    landingPoints: [{ name: "Baler, Aurora", lat: 15.76, lon: 121.56 }],
  },
];

export interface MajorPort {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export const MAJOR_PORTS: MajorPort[] = [
  { id: "manila-intl", name: "Port of Manila (International)", lat: 14.58, lon: 120.96 },
  { id: "batangas", name: "Port of Batangas", lat: 13.76, lon: 121.05 },
  { id: "cebu", name: "Port of Cebu", lat: 10.3, lon: 123.9 },
  { id: "subic", name: "Subic Bay Freeport", lat: 14.79, lon: 120.28 },
  { id: "davao", name: "Port of Davao", lat: 7.08, lon: 125.63 },
  { id: "cagayan-de-oro", name: "Port of Cagayan de Oro", lat: 8.48, lon: 124.65 },
  { id: "general-santos", name: "Port of General Santos", lat: 6.11, lon: 125.17 },
  { id: "zamboanga", name: "Port of Zamboanga", lat: 6.91, lon: 122.07 },
];
