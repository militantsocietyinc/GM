import type { FastifyInstance } from "fastify";
import type { ApiResponse, AISummary } from "@bantay-pilipinas/shared";

export function registerSummarizeRoutes(app: FastifyInstance): void {
  app.post("/api/summarize", async (request) => {
    const { headlineIds } = request.body as { headlineIds: number[] };

    // TODO: Implement Groq -> OpenRouter -> Ollama fallback chain
    const response: ApiResponse<AISummary> = {
      data: {
        summaryText: `AI briefing based on ${headlineIds.length} headlines. Full implementation pending AI provider configuration.`,
        focalPoints: [],
        provider: "mock",
        createdAt: new Date().toISOString(),
      },
      meta: { freshness: "mock", timestamp: new Date().toISOString() },
    };
    return response;
  });
}
