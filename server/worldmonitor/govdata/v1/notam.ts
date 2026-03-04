import type {
  ServerContext,
  ListNotamsRequest,
  ListNotamsResponse,
  Notam,
} from '../../../../src/generated/server/worldmonitor/govdata/v1/service_server';
import { CHROME_UA } from '../../../_shared/constants';
import { cachedFetchJson } from '../../../_shared/redis';
import { validateNumberParam } from '../../../../src/utils/validation';

const FAA_NOTAM_API_URL = 'https://external-api.faa.gov/notamapi/v1/notams';
const REDIS_CACHE_KEY = 'govdata:notams:faa:v1';
const REDIS_CACHE_TTL = 900; // 15 min

// ========================================================================
// GeoJSON parser — FAA NOTAM API returns GeoJSON FeatureCollection
// ========================================================================

interface FaaNotamFeature {
  type: string;
  properties: {
    coreNOTAMData: {
      notam: {
        id: string;
        type: string;
        location: string;
        effectiveStart: string;
        effectiveEnd: string;
        text: string;
        classification: string;
        schedule: string;
      };
    };
  };
  geometry: {
    type: string;
    coordinates: [number, number];
  } | null;
}

interface FaaNotamGeoJson {
  type: string;
  features: FaaNotamFeature[];
}

/**
 * Parse FAA NOTAM GeoJSON response into our proto Notam shape.
 * Exported for unit testing.
 */
export function parseFaaNotamResponse(data: unknown): Notam[] {
  if (!data || typeof data !== 'object') return [];
  const geoJson = data as FaaNotamGeoJson;
  if (!Array.isArray(geoJson.features)) return [];

  return geoJson.features
    .map((feature): Notam | null => {
      try {
        const notamData = feature.properties?.coreNOTAMData?.notam;
        if (!notamData) return null;

        const coords = feature.geometry?.coordinates;
        // GeoJSON coordinates are [longitude, latitude]
        const longitude = coords?.[0] ?? 0;
        const latitude = coords?.[1] ?? 0;

        return {
          id: notamData.id || '',
          type: normalizeClassification(notamData.classification),
          description: notamData.text || '',
          latitude,
          longitude,
          radiusNm: 0, // FAA API does not include radius in basic GeoJSON
          effectiveFrom: notamData.effectiveStart ? Date.parse(notamData.effectiveStart) : 0,
          effectiveTo: notamData.effectiveEnd ? Date.parse(notamData.effectiveEnd) : 0,
          source: 'FAA',
          location: notamData.location || '',
        };
      } catch {
        return null;
      }
    })
    .filter((n): n is Notam => n !== null);
}

function normalizeClassification(classification: string): string {
  const upper = (classification || '').toUpperCase().trim();
  if (upper === 'TFR' || upper.includes('TEMPORARY FLIGHT')) return 'TFR';
  if (upper === 'NAVAID' || upper.includes('NAVAID')) return 'NAVAID';
  return 'NOTAM';
}

// ========================================================================
// RPC handler
// ========================================================================

export async function listNotams(
  _ctx: ServerContext,
  req: ListNotamsRequest,
): Promise<ListNotamsResponse> {
  // Check for required API key
  const apiKey = process.env.FAA_API_KEY;
  if (!apiKey) {
    return {
      notams: [],
      count: 0,
      status: 'error',
      errorMessage: 'FAA API key not configured. Set FAA_API_KEY environment variable.',
    };
  }

  const limit = validateNumberParam(req.limit || undefined, 'limit', 1, 200, true, 100);

  try {
    const cacheKey = `${REDIS_CACHE_KEY}:${req.region || 'all'}`;
    const result = await cachedFetchJson<{ notams: Notam[] }>(cacheKey, REDIS_CACHE_TTL, async () => {
      const notams = await fetchFaaNotams(apiKey, req.region);
      return notams.length > 0 ? { notams } : null;
    });

    const notams = result?.notams ?? [];
    const limited = notams.slice(0, limit);

    return {
      notams: limited,
      count: limited.length,
      status: 'ok',
      errorMessage: '',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error fetching NOTAMs';
    console.warn(`[Govdata] NOTAM fetch failed: ${msg}`);
    return {
      notams: [],
      count: 0,
      status: 'error',
      errorMessage: msg,
    };
  }
}

async function fetchFaaNotams(apiKey: string, region?: string): Promise<Notam[]> {
  const params = new URLSearchParams({
    responseFormat: 'geoJson',
  });
  // Filter by domestic region if specified
  if (region) {
    params.set('domesticLocation', region);
  }

  const url = `${FAA_NOTAM_API_URL}?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': CHROME_UA,
      'client_id': apiKey,
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`FAA API returned HTTP ${response.status}`);
  }

  const data = await response.json();
  return parseFaaNotamResponse(data);
}
