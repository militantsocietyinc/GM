import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import rateLimit from "@fastify/rate-limit";
import { registerNewsRoutes } from "./routes/news.js";
import { registerWPSRoutes } from "./routes/wps.js";
import { registerDisasterRoutes } from "./routes/disaster.js";
import { registerMarketRoutes } from "./routes/market.js";
import { registerMilitaryRoutes } from "./routes/military.js";
import { registerRiskScoreRoutes } from "./routes/risk-scores.js";
import { registerSummarizeRoutes } from "./routes/summarize.js";
import { registerHealthRoutes } from "./routes/health.js";
import { startScheduler } from "./scrapers/scheduler.js";
import { registerRealtimeWS } from "./ws/realtime.js";

const PORT = parseInt(process.env.PORT || "3001", 10);
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

async function main(): Promise<void> {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: [FRONTEND_URL, "http://localhost:5173"],
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  await app.register(websocket);

  registerNewsRoutes(app);
  registerWPSRoutes(app);
  registerDisasterRoutes(app);
  registerMarketRoutes(app);
  registerMilitaryRoutes(app);
  registerRiskScoreRoutes(app);
  registerSummarizeRoutes(app);
  registerHealthRoutes(app);

  registerRealtimeWS(app);

  startScheduler();

  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`Bantay Pilipinas API listening on port ${PORT}`);
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
