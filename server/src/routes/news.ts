import type { FastifyInstance } from "fastify";
import type { NewsArticle, ApiResponse } from "@bantay-pilipinas/shared";

const MOCK_NEWS: NewsArticle[] = [
  {
    id: 1,
    urlHash: "abc123",
    title: "DFA files diplomatic protest over latest WPS incident",
    url: "https://example.com/news/1",
    source: "Philippine News Agency",
    sourceTier: 1,
    category: "wps-maritime" as never,
    publishedAt: new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
    entities: ["DFA", "WPS"],
    sentiment: "negative",
  },
  {
    id: 2,
    urlHash: "def456",
    title: "PSEi closes higher on foreign fund inflows",
    url: "https://example.com/news/2",
    source: "BusinessWorld",
    sourceTier: 2,
    category: "economy" as never,
    publishedAt: new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
    entities: ["PSE"],
    sentiment: "positive",
  },
];

export function registerNewsRoutes(app: FastifyInstance): void {
  app.get("/api/news", async (request) => {
    const { category } = request.query as { category?: string };
    let articles = MOCK_NEWS;
    if (category) {
      articles = articles.filter((a) => a.category === category);
    }
    const response: ApiResponse<NewsArticle[]> = {
      data: articles,
      meta: { freshness: "mock", timestamp: new Date().toISOString() },
    };
    return response;
  });
}
