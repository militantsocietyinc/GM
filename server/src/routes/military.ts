import type { FastifyInstance } from "fastify";
import type { ApiResponse } from "@bantay-pilipinas/shared";

interface MilitaryFlight {
  icao24: string;
  callsign: string | null;
  lat: number;
  lon: number;
  altitude: number;
  heading: number;
  classification: string;
  lastSeen: string;
}

export function registerMilitaryRoutes(app: FastifyInstance): void {
  app.get("/api/military", async () => {
    const response: ApiResponse<MilitaryFlight[]> = {
      data: [],
      meta: { freshness: "mock", timestamp: new Date().toISOString() },
    };
    return response;
  });
}
