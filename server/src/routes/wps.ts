import type { FastifyInstance } from "fastify";
import type { ApiResponse, TrackedVessel, WPSIncident, WPSTensionScore } from "@bantay-pilipinas/shared";

const MOCK_VESSELS: TrackedVessel[] = [
  {
    mmsi: 412000001,
    name: "CCG 5901",
    classification: "ccg" as never,
    flagState: "CN",
    lat: 15.12,
    lon: 117.75,
    heading: 180,
    speed: 5.2,
    inEez: true,
    nearFeature: "Scarborough Shoal",
    recordedAt: new Date().toISOString(),
  },
];

const MOCK_TENSION: WPSTensionScore = {
  score: 42.5,
  components: {
    vesselIntrusions: 55,
    diplomaticSignals: 30,
    militaryActivity: 45,
    newsVelocity: 35,
  },
  level: "elevated" as never,
  trend: "stable",
  computedAt: new Date().toISOString(),
};

export function registerWPSRoutes(app: FastifyInstance): void {
  app.get("/api/wps", async () => {
    const response: ApiResponse<TrackedVessel[]> = {
      data: MOCK_VESSELS,
      meta: { freshness: "mock", timestamp: new Date().toISOString() },
    };
    return response;
  });

  app.get("/api/wps/incidents", async () => {
    const response: ApiResponse<WPSIncident[]> = {
      data: [],
      meta: { freshness: "mock", timestamp: new Date().toISOString() },
    };
    return response;
  });

  app.get("/api/wps/tension", async () => {
    const response: ApiResponse<WPSTensionScore> = {
      data: MOCK_TENSION,
      meta: { freshness: "mock", timestamp: new Date().toISOString() },
    };
    return response;
  });
}
