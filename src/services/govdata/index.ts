import {
  GovdataServiceClient,
  type Notam as ProtoNotam,
} from '@/generated/client/worldmonitor/govdata/v1/service_client';
import { createCircuitBreaker } from '@/utils';

// --- Consumer-friendly types ---

export interface NotamAlert {
  id: string;
  type: 'TFR' | 'NOTAM' | 'NAVAID';
  description: string;
  latitude: number;
  longitude: number;
  radiusNm: number;
  effectiveFrom: Date;
  effectiveTo: Date;
  source: string;
  location: string;
}

// --- Internal: proto -> display mapping ---

function toDisplayNotam(proto: ProtoNotam): NotamAlert {
  return {
    id: proto.id,
    type: (proto.type as NotamAlert['type']) || 'NOTAM',
    description: proto.description,
    latitude: proto.latitude,
    longitude: proto.longitude,
    radiusNm: proto.radiusNm,
    effectiveFrom: new Date(proto.effectiveFrom),
    effectiveTo: new Date(proto.effectiveTo),
    source: proto.source,
    location: proto.location,
  };
}

// --- Client + circuit breaker ---

const client = new GovdataServiceClient('', { fetch: (...args) => globalThis.fetch(...args) });
const breaker = createCircuitBreaker<NotamAlert[]>({ name: 'NOTAM/TFR', cacheTtlMs: 15 * 60 * 1000, persistCache: true });

// --- Main fetch (public API) ---

export async function fetchNotams(region?: string): Promise<NotamAlert[]> {
  return breaker.execute(async () => {
    const response = await client.listNotams({
      region: region ?? '',
      limit: 100,
    });
    return response.notams.map(toDisplayNotam);
  }, []);
}
