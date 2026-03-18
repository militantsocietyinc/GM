/**
 * Unified LLM Provider — routes all inference through a single abstraction.
 *
 * Provider priority: Ollama (local Llama) → Groq (cloud fallback) → OpenRouter (last resort)
 *
 * The system is designed around small-parameter Llama models (3B-8B) running
 * locally via Ollama. Cloud providers exist only as degraded fallbacks.
 *
 * All providers use the OpenAI-compatible chat completions API format.
 */

declare const process: { env: Record<string, string | undefined> };

// ============================================================================
// TYPES
// ============================================================================

export interface LLMRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  /** Force JSON output parsing */
  jsonMode?: boolean;
}

export interface LLMResponse {
  content: string;
  provider: string;
  model: string;
  cached: boolean;
  latencyMs: number;
}

export interface ProviderConfig {
  id: string;
  name: string;
  apiUrl: string;
  model: string;
  headers: Record<string, string>;
  extraBody?: Record<string, unknown>;
  available: boolean;
  priority: number;
}

// ============================================================================
// PROVIDER RESOLUTION
// ============================================================================

/** Build the ordered provider list — local Llama first, cloud fallbacks after */
export function resolveProviders(): ProviderConfig[] {
  const providers: ProviderConfig[] = [];

  // Priority 0: Ollama (local Llama — preferred)
  const ollamaUrl = process.env.OLLAMA_API_URL;
  if (ollamaUrl) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const apiKey = process.env.OLLAMA_API_KEY;
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    providers.push({
      id: 'ollama',
      name: 'Ollama (Local Llama)',
      apiUrl: new URL('/v1/chat/completions', ollamaUrl).toString(),
      model: process.env.OLLAMA_MODEL || 'llama3.2:3b',
      headers,
      extraBody: { think: false },
      available: true,
      priority: 0,
    });
  }

  // Priority 1: Groq (cloud — fast inference, free tier)
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    providers.push({
      id: 'groq',
      name: 'Groq Cloud',
      apiUrl: 'https://api.groq.com/openai/v1/chat/completions',
      model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      available: true,
      priority: 1,
    });
  }

  // Priority 2: OpenRouter (cloud — last resort)
  const orKey = process.env.OPENROUTER_API_KEY;
  if (orKey) {
    providers.push({
      id: 'openrouter',
      name: 'OpenRouter',
      apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
      model: 'openrouter/free',
      headers: {
        'Authorization': `Bearer ${orKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://worldmonitor.app',
        'X-Title': 'WorldMonitor',
      },
      available: true,
      priority: 2,
    });
  }

  return providers.sort((a, b) => a.priority - b.priority);
}

/** Get the primary (highest priority) available provider */
export function getPrimaryProvider(): ProviderConfig | null {
  const providers = resolveProviders();
  return providers[0] ?? null;
}

/** Get the model name of the primary provider */
export function getPrimaryModel(): string {
  return getPrimaryProvider()?.model ?? 'none';
}

// ============================================================================
// CIRCUIT BREAKER
// ============================================================================

interface CircuitState {
  failures: number;
  lastFailure: number;
  open: boolean;
}

const circuits = new Map<string, CircuitState>();
const CIRCUIT_THRESHOLD = 3;
const CIRCUIT_RESET_MS = 60_000; // 1 minute

function isCircuitOpen(providerId: string): boolean {
  const state = circuits.get(providerId);
  if (!state || !state.open) return false;
  if (Date.now() - state.lastFailure > CIRCUIT_RESET_MS) {
    state.open = false;
    state.failures = 0;
    return false;
  }
  return true;
}

function recordFailure(providerId: string): void {
  const state = circuits.get(providerId) ?? { failures: 0, lastFailure: 0, open: false };
  state.failures++;
  state.lastFailure = Date.now();
  if (state.failures >= CIRCUIT_THRESHOLD) state.open = true;
  circuits.set(providerId, state);
}

function recordSuccess(providerId: string): void {
  circuits.set(providerId, { failures: 0, lastFailure: 0, open: false });
}

// ============================================================================
// CORE INFERENCE — tries providers in priority order with circuit breaker
// ============================================================================

const UPSTREAM_TIMEOUT_MS = 30_000;

export async function infer(req: LLMRequest): Promise<LLMResponse | null> {
  const providers = resolveProviders();
  if (providers.length === 0) return null;

  for (const provider of providers) {
    if (isCircuitOpen(provider.id)) continue;

    try {
      const start = Date.now();
      const body: Record<string, unknown> = {
        model: provider.model,
        messages: [
          { role: 'system', content: req.systemPrompt },
          { role: 'user', content: req.userPrompt },
        ],
        temperature: req.temperature ?? 0,
        max_tokens: req.maxTokens ?? 150,
        ...provider.extraBody,
      };

      const resp = await fetch(provider.apiUrl, {
        method: 'POST',
        headers: provider.headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });

      if (resp.status === 429) {
        recordFailure(provider.id);
        continue;
      }

      if (!resp.ok) {
        recordFailure(provider.id);
        continue;
      }

      const data = (await resp.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content?.trim() ?? '';

      if (!content) {
        recordFailure(provider.id);
        continue;
      }

      // Strip thinking tags (common with reasoning models)
      const cleaned = stripThinkingTags(content);

      recordSuccess(provider.id);
      return {
        content: cleaned,
        provider: provider.id,
        model: provider.model,
        cached: false,
        latencyMs: Date.now() - start,
      };
    } catch {
      recordFailure(provider.id);
      continue;
    }
  }

  return null;
}

// ============================================================================
// CONVENIENCE: JSON inference (for classification, structured output)
// ============================================================================

export async function inferJSON<T = unknown>(req: LLMRequest): Promise<{ data: T; provider: string; model: string } | null> {
  const response = await infer({ ...req, jsonMode: true });
  if (!response) return null;

  try {
    // Extract JSON from response (handle markdown fences)
    let jsonStr = response.content;
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonStr = fenceMatch[1]!;

    const data = JSON.parse(jsonStr.trim()) as T;
    return { data, provider: response.provider, model: response.model };
  } catch {
    return null;
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function stripThinkingTags(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\|thinking\|>[\s\S]*?<\|\/thinking\|>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .replace(/<reflection>[\s\S]*?<\/reflection>/gi, '')
    .trim();
}

/** Get status of all providers for diagnostics */
export function getProviderStatus(): Array<{
  id: string;
  name: string;
  model: string;
  available: boolean;
  circuitOpen: boolean;
  failures: number;
}> {
  return resolveProviders().map(p => {
    const circuit = circuits.get(p.id);
    return {
      id: p.id,
      name: p.name,
      model: p.model,
      available: p.available,
      circuitOpen: circuit?.open ?? false,
      failures: circuit?.failures ?? 0,
    };
  });
}
