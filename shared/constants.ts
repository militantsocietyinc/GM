export const PH_CENTER = { lat: 12.8797, lon: 121.774 } as const;
export const PH_DEFAULT_ZOOM = 6;

export const PH_BOUNDS = {
  north: 21.5,
  south: 4.5,
  west: 116.0,
  east: 127.0,
} as const;

export const PH_EEZ_BOUNDS = {
  north: 22.0,
  south: 3.0,
  west: 114.0,
  east: 128.0,
} as const;

export const PH_TIMEZONE = "Asia/Manila";

export enum NewsCategory {
  NationalPolitics = "national-politics",
  WPSMaritime = "wps-maritime",
  Defense = "defense",
  Economy = "economy",
  Disaster = "disaster",
  Crime = "crime",
  OFW = "ofw-diaspora",
  Environment = "environment",
  Technology = "technology",
  Regional = "regional",
}

export enum SourceTier {
  WireGov = 1,
  MajorNational = 2,
  SpecialistRegional = 3,
  AggregatorInternational = 4,
}

export enum VesselClassification {
  CCG = "ccg",
  PLAN = "plan",
  PAFMM = "pafmm",
  PHNavy = "ph-navy",
  PHCoastGuard = "ph-coast-guard",
  USNavy = "us-navy",
  Fishing = "fishing",
  Commercial = "commercial",
  Unknown = "unknown",
}

export enum PAGASASignal {
  None = 0,
  Signal1 = 1,
  Signal2 = 2,
  Signal3 = 3,
  Signal4 = 4,
  Signal5 = 5,
}

export enum StabilityLevel {
  Low = "low",
  Guarded = "guarded",
  Elevated = "elevated",
  High = "high",
  Severe = "severe",
}

export enum RegionId {
  NCR = "ncr",
  BARMM = "barmm",
  WPS = "wps",
  CAR = "car",
  EVBicol = "ev-bicol",
}

export const REGION_BASELINES: Record<RegionId, number> = {
  [RegionId.NCR]: 15,
  [RegionId.BARMM]: 40,
  [RegionId.WPS]: 35,
  [RegionId.CAR]: 25,
  [RegionId.EVBicol]: 20,
};
