import type {
  ServerContext,
  GetCountryIntelBriefRequest,
  GetCountryIntelBriefResponse,
} from '../../../../src/generated/server/worldmonitor/intelligence/v1/service_server';

import { cachedFetchJsonWithMeta, getCachedJson, setCachedJson } from '../../../_shared/redis';
import { UPSTREAM_TIMEOUT_MS, TIER1_COUNTRIES, sha256Hex } from './_shared';
import { callLlm } from '../../../_shared/llm';

const INTEL_CACHE_TTL = 7200;
const NEG_SENTINEL = '__WM_NEG__';

function buildUnavailableResponse(
  countryCode: string,
  countryName: string,
): GetCountryIntelBriefResponse {
  return {
    countryCode,
    countryName,
    brief: '',
    model: '',
    generatedAt: Date.now(),
    fetchedAt: '',
    cached: false,
    upstreamUnavailable: true,
    sourceMode: 'unavailable',
  };
}

function normalizeBriefResponse(
  data: Partial<GetCountryIntelBriefResponse>,
  countryCode: string,
  countryName: string,
  options?: {
    cached?: boolean;
    upstreamUnavailable?: boolean;
    sourceMode?: string;
  },
): GetCountryIntelBriefResponse {
  const generatedAt = typeof data.generatedAt === 'number' ? data.generatedAt : Date.now();
  const hasBrief = typeof data.brief === 'string' && data.brief.trim().length > 0;
  const cached = options?.cached ?? data.cached ?? false;
  const upstreamUnavailable = options?.upstreamUnavailable ?? data.upstreamUnavailable ?? false;
  const sourceMode = options?.sourceMode
    ?? data.sourceMode
    ?? ((upstreamUnavailable && !hasBrief)
      ? 'unavailable'
      : cached
        ? 'cached'
        : 'live');

  return {
    countryCode,
    countryName,
    brief: typeof data.brief === 'string' ? data.brief : '',
    model: typeof data.model === 'string' ? data.model : '',
    generatedAt,
    fetchedAt: typeof data.fetchedAt === 'string' && data.fetchedAt
      ? data.fetchedAt
      : new Date(generatedAt).toISOString(),
    cached,
    upstreamUnavailable,
    sourceMode,
  };
}

export async function getCountryIntelBrief(
  ctx: ServerContext,
  req: GetCountryIntelBriefRequest,
): Promise<GetCountryIntelBriefResponse> {
  const countryName = TIER1_COUNTRIES[req.countryCode] || req.countryCode;
  const empty = buildUnavailableResponse(req.countryCode, countryName);

  if (!req.countryCode) return empty;

  let contextSnapshot = '';
  let lang = 'en';
  let refresh = false;
  try {
    const url = new URL(ctx.request.url);
    contextSnapshot = (url.searchParams.get('context') || '').trim().slice(0, 4000);
    lang = url.searchParams.get('lang') || 'en';
    refresh = url.searchParams.get('refresh') === '1' || url.searchParams.get('prefer_live') === '1';
  } catch {
    contextSnapshot = '';
  }

  const contextHash = contextSnapshot ? (await sha256Hex(contextSnapshot)).slice(0, 16) : 'base';
  const cacheKey = `ci-sebuf:v2:${req.countryCode}:${lang}:${contextHash}`;
  const dateStr = new Date().toISOString().split('T')[0];

  const systemPrompt = `You are a senior intelligence analyst providing comprehensive country situation briefs. Current date: ${dateStr}. Provide geopolitical context appropriate for the current date.

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
- Use plain language, not jargon
- If a context snapshot is provided, explicitly reflect each non-zero signal category in the brief${lang === 'fr' ? '\n- IMPORTANT: You MUST respond ENTIRELY in French language.' : ''}`;

  const userPromptParts = [`Country: ${countryName} (${req.countryCode})`];
  if (contextSnapshot) {
    userPromptParts.push(`Context snapshot:\n${contextSnapshot}`);
  }

  const fetchFreshBrief = async (): Promise<GetCountryIntelBriefResponse | null> => {
    const llmResult = await callLlm({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPromptParts.join('\n\n') },
      ],
      temperature: 0.4,
      maxTokens: 900,
      timeoutMs: UPSTREAM_TIMEOUT_MS,
    });

    if (!llmResult) return null;

    const generatedAt = Date.now();
    return {
      countryCode: req.countryCode,
      countryName,
      brief: llmResult.content,
      model: llmResult.model,
      generatedAt,
      fetchedAt: new Date(generatedAt).toISOString(),
      cached: false,
      upstreamUnavailable: false,
      sourceMode: 'live',
    };
  };

  if (refresh) {
    try {
      const live = await fetchFreshBrief();
      if (live) {
        await setCachedJson(cacheKey, live, INTEL_CACHE_TTL);
        return live;
      }
    } catch {
      // Fall through to cached data when a live refresh fails.
    }

    try {
      const cached = await getCachedJson(cacheKey);
      if (cached && cached !== NEG_SENTINEL) {
        return normalizeBriefResponse(
          cached as Partial<GetCountryIntelBriefResponse>,
          req.countryCode,
          countryName,
          { cached: true, upstreamUnavailable: true, sourceMode: 'cached' },
        );
      }
    } catch {
      return empty;
    }

    return empty;
  }

  try {
    const { data, source } = await cachedFetchJsonWithMeta<GetCountryIntelBriefResponse>(cacheKey, INTEL_CACHE_TTL, fetchFreshBrief);
    if (!data) return empty;

    return normalizeBriefResponse(data, req.countryCode, countryName, {
      cached: source === 'cache',
      sourceMode: source === 'cache' ? 'cached' : 'live',
    });
  } catch {
    return empty;
  }
}
