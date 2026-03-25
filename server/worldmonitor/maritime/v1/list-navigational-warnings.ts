import type {
  ServerContext,
  ListNavigationalWarningsRequest,
  ListNavigationalWarningsResponse,
  NavigationalWarning,
} from '../../../../src/generated/server/worldmonitor/maritime/v1/service_server';

import { CHROME_UA } from '../../../_shared/constants';
import { cachedFetchJsonWithMeta, getCachedJson, setCachedJson } from '../../../_shared/redis';

const REDIS_CACHE_KEY = 'maritime:navwarnings:v1';
const REDIS_CACHE_TTL = 3600; // 1 hr — NGA broadcasts update daily
const NEG_SENTINEL = '__WM_NEG__';

// ========================================================================
// Helpers
// ========================================================================

const NGA_WARNINGS_URL = 'https://msi.nga.mil/api/publications/broadcast-warn?output=json&status=A';

function parseNgaDate(dateStr: unknown): number {
  if (!dateStr || typeof dateStr !== 'string') return 0;
  const match = dateStr.match(/(\d{2})(\d{4})Z\s+([A-Z]{3})\s+(\d{4})/i);
  if (!match) return Date.parse(dateStr) || 0;
  const months: Record<string, number> = {
    JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
    JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
  };
  const day = parseInt(match[1]!, 10);
  const hours = parseInt(match[2]!.slice(0, 2), 10);
  const minutes = parseInt(match[2]!.slice(2, 4), 10);
  const month = months[match[3]!.toUpperCase()] ?? 0;
  const year = parseInt(match[4]!, 10);
  return Date.UTC(year, month, day, hours, minutes);
}

async function fetchNgaWarnings(area?: string): Promise<NavigationalWarning[]> {
  try {
    const response = await fetch(NGA_WARNINGS_URL, {
      headers: { Accept: 'application/json', 'User-Agent': CHROME_UA },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return [];

    const data = await response.json();
    const rawWarnings: any[] = Array.isArray(data) ? data : (data?.broadcast_warn ?? []);

    let warnings: NavigationalWarning[] = rawWarnings.map((w: any): NavigationalWarning => ({
      id: `${w.navArea || ''}-${w.msgYear || ''}-${w.msgNumber || ''}`,
      title: `NAVAREA ${w.navArea || ''} ${w.msgNumber || ''}/${w.msgYear || ''}`,
      text: w.text || '',
      area: `${w.navArea || ''}${w.subregion ? ` ${w.subregion}` : ''}`,
      location: undefined,
      issuedAt: parseNgaDate(w.issueDate),
      expiresAt: 0,
      authority: w.authority || '',
    }));

    if (area) {
      const areaLower = area.toLowerCase();
      warnings = warnings.filter((warning) =>
        warning.area.toLowerCase().includes(areaLower)
        || warning.text.toLowerCase().includes(areaLower));
    }

    return warnings;
  } catch {
    return [];
  }
}

function buildUnavailableResponse(): ListNavigationalWarningsResponse {
  return {
    warnings: [],
    pagination: undefined,
    fetchedAt: '',
    cached: false,
    upstreamUnavailable: true,
    sourceMode: 'unavailable',
  };
}

function normalizeResponse(
  raw: Partial<ListNavigationalWarningsResponse>,
  overrides?: {
    cached?: boolean;
    upstreamUnavailable?: boolean;
    sourceMode?: string;
  },
): ListNavigationalWarningsResponse {
  const hasData = Array.isArray(raw.warnings) && raw.warnings.length > 0;
  const cached = overrides?.cached ?? raw.cached ?? false;
  const upstreamUnavailable = overrides?.upstreamUnavailable ?? raw.upstreamUnavailable ?? false;

  return {
    warnings: Array.isArray(raw.warnings) ? raw.warnings : [],
    pagination: raw.pagination,
    fetchedAt: typeof raw.fetchedAt === 'string' ? raw.fetchedAt : '',
    cached,
    upstreamUnavailable,
    sourceMode: overrides?.sourceMode
      ?? raw.sourceMode
      ?? ((upstreamUnavailable && !hasData) ? 'unavailable' : cached ? 'cached' : 'live'),
  };
}

// ========================================================================
// RPC handler
// ========================================================================

export async function listNavigationalWarnings(
  ctx: ServerContext,
  req: ListNavigationalWarningsRequest,
): Promise<ListNavigationalWarningsResponse> {
  const cacheKey = `${REDIS_CACHE_KEY}:${req.area || 'all'}`;

  const fetchFreshWarnings = async (): Promise<ListNavigationalWarningsResponse | null> => {
    const warnings = await fetchNgaWarnings(req.area);
    if (warnings.length === 0) return null;
    return {
      warnings,
      pagination: undefined,
      fetchedAt: new Date().toISOString(),
      cached: false,
      upstreamUnavailable: false,
      sourceMode: 'live',
    };
  };

  try {
    let refresh = false;
    try {
      const url = new URL(ctx.request.url);
      refresh = url.searchParams.get('refresh') === '1' || url.searchParams.get('prefer_live') === '1';
    } catch {
      refresh = false;
    }

    if (refresh) {
      try {
        const live = await fetchFreshWarnings();
        if (live) {
          await setCachedJson(cacheKey, live, REDIS_CACHE_TTL);
          return live;
        }
      } catch {
        // Fall through to cached data.
      }

      const cached = await getCachedJson(cacheKey);
      if (cached && cached !== NEG_SENTINEL) {
        return normalizeResponse(cached as Partial<ListNavigationalWarningsResponse>, {
          cached: true,
          upstreamUnavailable: true,
          sourceMode: 'cached',
        });
      }
      return buildUnavailableResponse();
    }

    const { data, source } = await cachedFetchJsonWithMeta<ListNavigationalWarningsResponse>(
      cacheKey,
      REDIS_CACHE_TTL,
      fetchFreshWarnings,
    );
    if (!data) return buildUnavailableResponse();
    return normalizeResponse(data, {
      cached: source === 'cache',
      sourceMode: source === 'cache' ? 'cached' : 'live',
    });
  } catch {
    return buildUnavailableResponse();
  }
}
