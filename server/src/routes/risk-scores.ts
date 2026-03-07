import type { FastifyInstance } from "fastify";
import type { ApiResponse, RegionalStabilityScore, WPSTensionScore } from "@bantay-pilipinas/shared";

const MOCK_REGIONS: RegionalStabilityScore[] = [
  {
    regionId: "ncr" as never,
    score: 22.5,
    components: { baselineRisk: 15, unrest: 25, security: 20, information: 30 },
    boosts: {},
    level: "guarded" as never,
    trend: "stable",
    computedAt: new Date().toISOString(),
  },
  {
    regionId: "barmm" as never,
    score: 45.0,
    components: { baselineRisk: 40, unrest: 50, security: 48, information: 40 },
    boosts: {},
    level: "elevated" as never,
    trend: "stable",
    computedAt: new Date().toISOString(),
  },
  {
    regionId: "wps" as never,
    score: 42.5,
    components: { baselineRisk: 35, unrest: 0, security: 55, information: 45 },
    boosts: {},
    level: "elevated" as never,
    trend: "rising",
    computedAt: new Date().toISOString(),
  },
  {
    regionId: "car" as never,
    score: 28.0,
    components: { baselineRisk: 25, unrest: 30, security: 28, information: 30 },
    boosts: {},
    level: "guarded" as never,
    trend: "falling",
    computedAt: new Date().toISOString(),
  },
  {
    regionId: "ev-bicol" as never,
    score: 25.0,
    components: { baselineRisk: 20, unrest: 15, security: 22, information: 40 },
    boosts: {},
    level: "guarded" as never,
    trend: "stable",
    computedAt: new Date().toISOString(),
  },
];

const MOCK_WPS_TENSION: WPSTensionScore = {
  score: 42.5,
  components: { vesselIntrusions: 55, diplomaticSignals: 30, militaryActivity: 45, newsVelocity: 35 },
  level: "elevated" as never,
  trend: "stable",
  computedAt: new Date().toISOString(),
};

export function registerRiskScoreRoutes(app: FastifyInstance): void {
  app.get("/api/risk-scores", async () => {
    const response: ApiResponse<{ regions: RegionalStabilityScore[]; wpsTension: WPSTensionScore }> = {
      data: { regions: MOCK_REGIONS, wpsTension: MOCK_WPS_TENSION },
      meta: { freshness: "mock", timestamp: new Date().toISOString() },
    };
    return response;
  });

  app.get("/api/risk-scores/history", async () => {
    const response: ApiResponse<RegionalStabilityScore[]> = {
      data: [],
      meta: { freshness: "mock", timestamp: new Date().toISOString() },
    };
    return response;
  });
}
