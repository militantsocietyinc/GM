import type { FastifyInstance } from "fastify";
import type { ApiResponse, Typhoon, Earthquake, VolcanoStatus } from "@bantay-pilipinas/shared";

const MOCK_EARTHQUAKES: Earthquake[] = [
  {
    id: 1,
    magnitude: 4.2,
    depthKm: 15,
    lat: 14.5,
    lon: 121.0,
    locationText: "10km SE of Tanay, Rizal",
    intensity: 3,
    tsunamiAdvisory: false,
    source: "phivolcs",
    occurredAt: new Date().toISOString(),
  },
];

const MOCK_VOLCANOES: VolcanoStatus[] = [
  {
    id: "taal",
    name: "Taal",
    lat: 14.002,
    lon: 120.993,
    alertLevel: 1,
    alertDescription: "Low level unrest",
    observations: ["Volcanic SO2 emissions measured at 2,500 tonnes/day"],
    lastBulletinAt: new Date().toISOString(),
  },
  {
    id: "mayon",
    name: "Mayon",
    lat: 13.257,
    lon: 123.685,
    alertLevel: 0,
    alertDescription: "Normal",
    observations: [],
    lastBulletinAt: new Date().toISOString(),
  },
];

export function registerDisasterRoutes(app: FastifyInstance): void {
  app.get("/api/disaster", async () => {
    const response: ApiResponse<{ typhoons: Typhoon[]; earthquakes: Earthquake[]; volcanoes: VolcanoStatus[] }> = {
      data: {
        typhoons: [],
        earthquakes: MOCK_EARTHQUAKES,
        volcanoes: MOCK_VOLCANOES,
      },
      meta: { freshness: "mock", timestamp: new Date().toISOString() },
    };
    return response;
  });
}
