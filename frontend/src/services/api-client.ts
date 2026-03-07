import type {
  ApiResponse,
  NewsArticle,
  TrackedVessel,
  WPSIncident,
  WPSTensionScore,
  Typhoon,
  Earthquake,
  VolcanoStatus,
  EconomicDataPoint,
  RegionalStabilityScore,
  AISummary,
  HealthResponse,
} from "@bantay-pilipinas/shared";

const API_BASE = import.meta.env.VITE_API_URL || "";

async function fetchJson<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

export class ApiClient {
  async getNews(category?: string): Promise<ApiResponse<NewsArticle[]>> {
    const params = category ? `?category=${encodeURIComponent(category)}` : "";
    return fetchJson(`/api/news${params}`);
  }

  async getWPSVessels(): Promise<ApiResponse<TrackedVessel[]>> {
    return fetchJson("/api/wps");
  }

  async getWPSIncidents(): Promise<ApiResponse<WPSIncident[]>> {
    return fetchJson("/api/wps/incidents");
  }

  async getWPSTension(): Promise<ApiResponse<WPSTensionScore>> {
    return fetchJson("/api/wps/tension");
  }

  async getDisaster(): Promise<ApiResponse<{ typhoons: Typhoon[]; earthquakes: Earthquake[]; volcanoes: VolcanoStatus[] }>> {
    return fetchJson("/api/disaster");
  }

  async getMarket(): Promise<ApiResponse<EconomicDataPoint[]>> {
    return fetchJson("/api/market");
  }

  async getRiskScores(): Promise<ApiResponse<{ regions: RegionalStabilityScore[]; wpsTension: WPSTensionScore }>> {
    return fetchJson("/api/risk-scores");
  }

  async getSummary(headlineIds: number[]): Promise<ApiResponse<AISummary>> {
    return fetchJson("/api/summarize", {
      method: "POST",
      body: JSON.stringify({ headlineIds }),
    });
  }

  async getHealth(): Promise<HealthResponse> {
    const res = await fetch(`${API_BASE}/api/health`);
    return res.json();
  }
}
