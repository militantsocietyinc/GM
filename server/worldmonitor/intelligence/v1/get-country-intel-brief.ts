declare const process: { env: Record<string, string | undefined> };

import type {
  ServerContext,
  GetCountryIntelBriefRequest,
  GetCountryIntelBriefResponse,
} from '../../../../src/generated/server/worldmonitor/intelligence/v1/service_server';

import { getCachedJson, setCachedJson } from '../../../_shared/redis';
import { infer, getPrimaryModel, TIER1_COUNTRIES } from './_shared';

// ========================================================================
// Constants
// ========================================================================

const INTEL_CACHE_TTL = 7200;

// ========================================================================
// RPC handler — uses unified LLM provider (local Llama preferred)
// ========================================================================

export async function getCountryIntelBrief(
  _ctx: ServerContext,
  req: GetCountryIntelBriefRequest,
): Promise<GetCountryIntelBriefResponse> {
  const model = getPrimaryModel();
  const empty: GetCountryIntelBriefResponse = {
    countryCode: req.countryCode,
    countryName: '',
    brief: '',
    model,
    generatedAt: Date.now(),
  };

  const cacheKey = `ci-sebuf:v1:${req.countryCode}`;
  const cached = (await getCachedJson(cacheKey)) as GetCountryIntelBriefResponse | null;
  if (cached?.brief) return cached;

  const countryName = TIER1_COUNTRIES[req.countryCode] || req.countryCode;
  const dateStr = new Date().toISOString().split('T')[0];

  try {
    const response = await infer({
      systemPrompt: `You are a senior intelligence analyst providing comprehensive country situation briefs. Current date: ${dateStr}. Provide geopolitical context appropriate for the current date.

Write a concise intelligence brief for the requested country covering:
1. Current Situation - what is happening right now
2. Military & Security Posture
3. Key Risk Factors
4. Regional Context
5. Outlook & Watch Items

Rules:
- Be specific and analytical
- 4-5 paragraphs, 250-350 words
- No speculation beyond what data supports
- Use plain language, not jargon`,
      userPrompt: `Country: ${countryName} (${req.countryCode})`,
      temperature: 0.4,
      maxTokens: 900,
    });

    if (!response) return empty;

    const result: GetCountryIntelBriefResponse = {
      countryCode: req.countryCode,
      countryName,
      brief: response.content,
      model: response.model,
      generatedAt: Date.now(),
    };

    if (response.content) await setCachedJson(cacheKey, result, INTEL_CACHE_TTL);
    return result;
  } catch {
    return empty;
  }
}
