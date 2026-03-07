import type { AISummary } from "@bantay-pilipinas/shared";

type Provider = "groq" | "openrouter" | "ollama" | "mock";

async function tryGroq(headlines: string[]): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  // TODO: Call Groq API with PH-focused system prompt
  void headlines;
  return null;
}

async function tryOpenRouter(headlines: string[]): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;
  // TODO: Call OpenRouter API
  void headlines;
  return null;
}

async function tryOllama(headlines: string[]): Promise<string | null> {
  const url = process.env.OLLAMA_API_URL;
  if (!url) return null;
  // TODO: Call local Ollama instance
  void headlines;
  return null;
}

export async function generateSummary(headlines: string[]): Promise<AISummary> {
  const providers: { name: Provider; fn: (h: string[]) => Promise<string | null> }[] = [
    { name: "groq", fn: tryGroq },
    { name: "openrouter", fn: tryOpenRouter },
    { name: "ollama", fn: tryOllama },
  ];

  for (const provider of providers) {
    const result = await provider.fn(headlines);
    if (result) {
      return {
        summaryText: result,
        focalPoints: [],
        provider: provider.name,
        createdAt: new Date().toISOString(),
      };
    }
  }

  return {
    summaryText: `Philippine intelligence briefing based on ${headlines.length} headlines. Configure GROQ_API_KEY or OPENROUTER_API_KEY for AI-powered summaries.`,
    focalPoints: [],
    provider: "mock",
    createdAt: new Date().toISOString(),
  };
}
