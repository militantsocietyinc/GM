import type {
  ServerContext,
  GetShippingRatesRequest,
  GetShippingRatesResponse,
} from '../../../../src/generated/server/worldmonitor/supply_chain/v1/service_server';

import { getCachedJson } from '../../../_shared/redis';

const REDIS_CACHE_KEY = 'supply_chain:shipping:v2';

export async function getShippingRates(
  _ctx: ServerContext,
  _req: GetShippingRatesRequest,
): Promise<GetShippingRatesResponse> {
  const buildUnavailable = (): GetShippingRatesResponse => ({
    indices: [],
    fetchedAt: '',
    upstreamUnavailable: true,
    cached: false,
    sourceMode: 'unavailable',
  });

  try {
    const result = await getCachedJson(REDIS_CACHE_KEY, true) as GetShippingRatesResponse | null;
    if (!result) return buildUnavailable();

    const hasData = Array.isArray(result.indices) && result.indices.length > 0;
    return {
      indices: Array.isArray(result.indices) ? result.indices : [],
      fetchedAt: typeof result.fetchedAt === 'string' ? result.fetchedAt : '',
      upstreamUnavailable: Boolean(result.upstreamUnavailable),
      cached: hasData,
      sourceMode: hasData ? 'cached' : 'unavailable',
    };
  } catch {
    return buildUnavailable();
  }
}
