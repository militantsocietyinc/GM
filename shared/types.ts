import type {
  NewsCategory,
  SourceTier,
  VesselClassification,
  StabilityLevel,
  RegionId,
  PAGASASignal,
} from "./constants.js";

export interface ApiResponse<T> {
  data: T;
  meta: {
    freshness: string;
    timestamp: string;
  };
}

export interface NewsArticle {
  id: number;
  urlHash: string;
  title: string;
  url: string;
  source: string;
  sourceTier: SourceTier;
  category: NewsCategory;
  publishedAt: string | null;
  fetchedAt: string;
  entities: string[];
  sentiment: "positive" | "negative" | "neutral";
}

export interface NewsCluster {
  id: string;
  title: string;
  articles: NewsArticle[];
  category: NewsCategory;
  velocity: number;
  firstSeen: string;
}

export interface TrackedVessel {
  mmsi: number;
  name: string | null;
  classification: VesselClassification;
  flagState: string | null;
  lat: number;
  lon: number;
  heading: number | null;
  speed: number | null;
  inEez: boolean;
  nearFeature: string | null;
  recordedAt: string;
}

export interface WPSIncident {
  id: number;
  type: string;
  location: string;
  lat: number;
  lon: number;
  description: string | null;
  severity: "low" | "medium" | "high" | "critical";
  vessels: TrackedVessel[];
  detectedAt: string;
  resolvedAt: string | null;
}

export interface Typhoon {
  id: string;
  internationalName: string | null;
  localName: string | null;
  lat: number;
  lon: number;
  maxWindKph: number | null;
  signalAreas: Record<string, PAGASASignal>;
  forecastTrack: ForecastPoint[];
  impactScore: number;
  isActive: boolean;
  updatedAt: string;
}

export interface ForecastPoint {
  lat: number;
  lon: number;
  timestamp: string;
  windKph: number | null;
}

export interface Earthquake {
  id: number;
  magnitude: number;
  depthKm: number | null;
  lat: number;
  lon: number;
  locationText: string | null;
  intensity: number | null;
  tsunamiAdvisory: boolean;
  source: string;
  occurredAt: string;
}

export interface VolcanoStatus {
  id: string;
  name: string;
  lat: number;
  lon: number;
  alertLevel: number;
  alertDescription: string | null;
  observations: string[];
  lastBulletinAt: string | null;
}

export interface RegionalStabilityScore {
  regionId: RegionId;
  score: number;
  components: {
    baselineRisk: number;
    unrest: number;
    security: number;
    information: number;
  };
  boosts: Record<string, number>;
  level: StabilityLevel;
  trend: "rising" | "falling" | "stable";
  computedAt: string;
}

export interface WPSTensionScore {
  score: number;
  components: {
    vesselIntrusions: number;
    diplomaticSignals: number;
    militaryActivity: number;
    newsVelocity: number;
  };
  level: StabilityLevel;
  trend: "rising" | "falling" | "stable";
  computedAt: string;
}

export interface EconomicDataPoint {
  id: number;
  indicator: string;
  value: number;
  currency: string;
  source: string;
  recordedAt: string;
}

export interface FeedHealthStatus {
  feedUrl: string;
  feedName: string;
  status: "active" | "degraded" | "down" | "cooldown";
  lastSuccessAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
}

export interface HealthResponse {
  status: "ok" | "degraded";
  database: "connected" | "disconnected";
  scrapers: Record<string, { status: string; lastRun: string | null }>;
  uptime: number;
}

export interface AISummary {
  summaryText: string;
  focalPoints: FocalPoint[];
  provider: string;
  createdAt: string;
}

export interface FocalPoint {
  title: string;
  description: string;
  category: NewsCategory;
  severity: "low" | "medium" | "high";
  relatedArticles: number[];
}
