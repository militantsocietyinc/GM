import type { FastifyInstance } from "fastify";
import type { HealthResponse } from "@bantay-pilipinas/shared";

const startTime = Date.now();

export function registerHealthRoutes(app: FastifyInstance): void {
  app.get("/api/health", async () => {
    const response: HealthResponse = {
      status: "ok",
      database: "disconnected",
      scrapers: {
        rss: { status: "idle", lastRun: null },
        pagasa: { status: "idle", lastRun: null },
        phivolcs: { status: "idle", lastRun: null },
        bsp: { status: "idle", lastRun: null },
        acled: { status: "idle", lastRun: null },
      },
      uptime: Math.floor((Date.now() - startTime) / 1000),
    };
    return response;
  });
}
