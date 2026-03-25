import { getRpcBaseUrl } from '@/services/rpc-client';
import {
  SupplyChainServiceClient,
  type GetShippingRatesResponse,
  type GetChokepointStatusResponse,
  type GetCriticalMineralsResponse,
  type ShippingIndex,
  type ChokepointInfo,
  type CriticalMineral,
  type MineralProducer,
  type ShippingRatePoint,
} from '@/generated/client/worldmonitor/supply_chain/v1/service_client';
import { createCircuitBreaker } from '@/utils';
import { getHydratedData } from '@/services/bootstrap';
import { normalizeSourceMode } from '@/utils/data-provenance';

export type {
  GetShippingRatesResponse,
  GetChokepointStatusResponse,
  GetCriticalMineralsResponse,
  ShippingIndex,
  ChokepointInfo,
  CriticalMineral,
  MineralProducer,
  ShippingRatePoint,
};

const client = new SupplyChainServiceClient(getRpcBaseUrl(), { fetch: (...args) => globalThis.fetch(...args) });

const shippingBreaker = createCircuitBreaker<GetShippingRatesResponse>({ name: 'Shipping Rates', cacheTtlMs: 60 * 60 * 1000, persistCache: true });
const chokepointBreaker = createCircuitBreaker<GetChokepointStatusResponse>({ name: 'Chokepoint Status', cacheTtlMs: 5 * 60 * 1000, persistCache: true });
const mineralsBreaker = createCircuitBreaker<GetCriticalMineralsResponse>({ name: 'Critical Minerals', cacheTtlMs: 24 * 60 * 60 * 1000, persistCache: true });

const emptyShipping: GetShippingRatesResponse = { indices: [], fetchedAt: '', upstreamUnavailable: true, cached: false, sourceMode: 'unavailable' };
const emptyChokepoints: GetChokepointStatusResponse = { chokepoints: [], fetchedAt: '', upstreamUnavailable: true, cached: false, sourceMode: 'unavailable' };
const emptyMinerals: GetCriticalMineralsResponse = { minerals: [], fetchedAt: '', upstreamUnavailable: true, cached: false, sourceMode: 'unavailable' };

function normalizeShippingResponse(data: GetShippingRatesResponse): GetShippingRatesResponse {
  const hasData = Array.isArray(data.indices) && data.indices.length > 0;
  return {
    ...data,
    fetchedAt: data.fetchedAt || '',
    upstreamUnavailable: Boolean(data.upstreamUnavailable),
    cached: data.cached ?? (hasData && !!data.fetchedAt),
    sourceMode: normalizeSourceMode(data, hasData),
  };
}

function normalizeChokepointResponse(data: GetChokepointStatusResponse): GetChokepointStatusResponse {
  const hasData = Array.isArray(data.chokepoints) && data.chokepoints.length > 0;
  return {
    ...data,
    fetchedAt: data.fetchedAt || '',
    upstreamUnavailable: Boolean(data.upstreamUnavailable),
    cached: data.cached ?? (hasData && !!data.fetchedAt),
    sourceMode: normalizeSourceMode(data, hasData),
  };
}

function normalizeMineralsResponse(data: GetCriticalMineralsResponse): GetCriticalMineralsResponse {
  const hasData = Array.isArray(data.minerals) && data.minerals.length > 0;
  return {
    ...data,
    fetchedAt: data.fetchedAt || '',
    upstreamUnavailable: Boolean(data.upstreamUnavailable),
    cached: data.cached ?? (hasData && !!data.fetchedAt),
    sourceMode: normalizeSourceMode(data, hasData),
  };
}

export async function fetchShippingRates(): Promise<GetShippingRatesResponse> {
  const hydrated = getHydratedData('shippingRates') as GetShippingRatesResponse | undefined;
  if (hydrated && ((hydrated.indices?.length ?? 0) > 0 || hydrated.upstreamUnavailable)) {
    return normalizeShippingResponse(hydrated);
  }

  try {
    const response = await shippingBreaker.execute(async () => {
      return client.getShippingRates({});
    }, emptyShipping);
    return normalizeShippingResponse(response);
  } catch {
    return emptyShipping;
  }
}

export async function fetchChokepointStatus(): Promise<GetChokepointStatusResponse> {
  const hydrated = getHydratedData('chokepoints') as GetChokepointStatusResponse | undefined;
  // Transit summaries are already folded into the chokepoint payload server-side.
  getHydratedData('chokepointTransits');
  if (hydrated && ((hydrated.chokepoints?.length ?? 0) > 0 || hydrated.upstreamUnavailable)) {
    return normalizeChokepointResponse(hydrated);
  }

  try {
    const response = await chokepointBreaker.execute(async () => {
      return client.getChokepointStatus({});
    }, emptyChokepoints);
    return normalizeChokepointResponse(response);
  } catch {
    return emptyChokepoints;
  }
}

export async function fetchCriticalMinerals(): Promise<GetCriticalMineralsResponse> {
  const hydrated = getHydratedData('minerals') as GetCriticalMineralsResponse | undefined;
  if (hydrated && ((hydrated.minerals?.length ?? 0) > 0 || hydrated.upstreamUnavailable)) {
    return normalizeMineralsResponse(hydrated);
  }

  try {
    const response = await mineralsBreaker.execute(async () => {
      return client.getCriticalMinerals({});
    }, emptyMinerals);
    return normalizeMineralsResponse(response);
  } catch {
    return emptyMinerals;
  }
}
