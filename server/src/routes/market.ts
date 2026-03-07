import type { FastifyInstance } from "fastify";
import type { ApiResponse, EconomicDataPoint } from "@bantay-pilipinas/shared";

const MOCK_DATA: EconomicDataPoint[] = [
  { id: 1, indicator: "PSEi", value: 6842.5, currency: "PHP", source: "pse", recordedAt: new Date().toISOString() },
  { id: 2, indicator: "USD/PHP", value: 56.85, currency: "PHP", source: "bsp", recordedAt: new Date().toISOString() },
  { id: 3, indicator: "BSP Rate", value: 6.25, currency: "PHP", source: "bsp", recordedAt: new Date().toISOString() },
];

export function registerMarketRoutes(app: FastifyInstance): void {
  app.get("/api/market", async () => {
    const response: ApiResponse<EconomicDataPoint[]> = {
      data: MOCK_DATA,
      meta: { freshness: "mock", timestamp: new Date().toISOString() },
    };
    return response;
  });
}
