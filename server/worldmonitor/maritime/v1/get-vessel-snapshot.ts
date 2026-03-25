import type {
  ServerContext,
  GetVesselSnapshotRequest,
  GetVesselSnapshotResponse,
  VesselSnapshot,
  AisDensityZone,
  AisDisruption,
  AisDisruptionType,
  AisDisruptionSeverity,
} from '../../../../src/generated/server/worldmonitor/maritime/v1/service_server';

import { getRelayBaseUrl, getRelayHeaders } from '../../../_shared/relay';

// ========================================================================
// Helpers
// ========================================================================

const DISRUPTION_TYPE_MAP: Record<string, AisDisruptionType> = {
  gap_spike: 'AIS_DISRUPTION_TYPE_GAP_SPIKE',
  chokepoint_congestion: 'AIS_DISRUPTION_TYPE_CHOKEPOINT_CONGESTION',
};

const SEVERITY_MAP: Record<string, AisDisruptionSeverity> = {
  low: 'AIS_DISRUPTION_SEVERITY_LOW',
  elevated: 'AIS_DISRUPTION_SEVERITY_ELEVATED',
  high: 'AIS_DISRUPTION_SEVERITY_HIGH',
};

// In-memory cache (matches old /api/ais-snapshot behavior)
const SNAPSHOT_CACHE_TTL_MS = 300_000; // 5 min -- matches client poll interval
let cachedSnapshot: VesselSnapshot | undefined;
let cachedFetchedAt = '';
let cacheTimestamp = 0;
let inFlightRequest: Promise<{ snapshot?: VesselSnapshot; fetchedAt: string } | null> | null = null;

function buildUnavailableResponse(): GetVesselSnapshotResponse {
  return {
    snapshot: undefined,
    fetchedAt: '',
    cached: false,
    upstreamUnavailable: true,
    sourceMode: 'unavailable',
  };
}

async function fetchVesselSnapshot(preferLive = false): Promise<GetVesselSnapshotResponse> {
  const now = Date.now();
  if (!preferLive && cachedSnapshot && (now - cacheTimestamp) < SNAPSHOT_CACHE_TTL_MS) {
    return {
      snapshot: cachedSnapshot,
      fetchedAt: cachedFetchedAt,
      cached: true,
      upstreamUnavailable: false,
      sourceMode: 'cached',
    };
  }

  if (inFlightRequest) {
    const shared = await inFlightRequest;
    if (shared?.snapshot) {
      return {
        snapshot: shared.snapshot,
        fetchedAt: shared.fetchedAt,
        cached: false,
        upstreamUnavailable: false,
        sourceMode: 'live',
      };
    }
    if (cachedSnapshot) {
      return {
        snapshot: cachedSnapshot,
        fetchedAt: cachedFetchedAt,
        cached: true,
        upstreamUnavailable: true,
        sourceMode: 'cached',
      };
    }
    return buildUnavailableResponse();
  }

  inFlightRequest = fetchVesselSnapshotFromRelay().then((snapshot) => {
    if (!snapshot) return null;
    return {
      snapshot,
      fetchedAt: new Date().toISOString(),
    };
  });

  try {
    const result = await inFlightRequest;
    if (result?.snapshot) {
      cachedSnapshot = result.snapshot;
      cachedFetchedAt = result.fetchedAt;
      cacheTimestamp = Date.now();
      return {
        snapshot: result.snapshot,
        fetchedAt: result.fetchedAt,
        cached: false,
        upstreamUnavailable: false,
        sourceMode: 'live',
      };
    }
    if (cachedSnapshot) {
      return {
        snapshot: cachedSnapshot,
        fetchedAt: cachedFetchedAt,
        cached: true,
        upstreamUnavailable: true,
        sourceMode: 'cached',
      };
    }
    return buildUnavailableResponse();
  } finally {
    inFlightRequest = null;
  }
}

async function fetchVesselSnapshotFromRelay(): Promise<VesselSnapshot | undefined> {
  try {
    const relayBaseUrl = getRelayBaseUrl();
    if (!relayBaseUrl) return undefined;

    const response = await fetch(
      `${relayBaseUrl}/ais/snapshot?candidates=false`,
      {
        headers: getRelayHeaders(),
        signal: AbortSignal.timeout(10000),
      },
    );

    if (!response.ok) return undefined;

    const data = await response.json();
    if (!data || !Array.isArray(data.disruptions) || !Array.isArray(data.density)) {
      return undefined;
    }

    const densityZones: AisDensityZone[] = data.density.map((z: any): AisDensityZone => ({
      id: String(z.id || ''),
      name: String(z.name || ''),
      location: {
        latitude: Number(z.lat) || 0,
        longitude: Number(z.lon) || 0,
      },
      intensity: Number(z.intensity) || 0,
      deltaPct: Number(z.deltaPct) || 0,
      shipsPerDay: Number(z.shipsPerDay) || 0,
      note: String(z.note || ''),
    }));

    const disruptions: AisDisruption[] = data.disruptions.map((d: any): AisDisruption => ({
      id: String(d.id || ''),
      name: String(d.name || ''),
      type: DISRUPTION_TYPE_MAP[d.type] || 'AIS_DISRUPTION_TYPE_UNSPECIFIED',
      location: {
        latitude: Number(d.lat) || 0,
        longitude: Number(d.lon) || 0,
      },
      severity: SEVERITY_MAP[d.severity] || 'AIS_DISRUPTION_SEVERITY_UNSPECIFIED',
      changePct: Number(d.changePct) || 0,
      windowHours: Number(d.windowHours) || 0,
      darkShips: Number(d.darkShips) || 0,
      vesselCount: Number(d.vesselCount) || 0,
      region: String(d.region || ''),
      description: String(d.description || ''),
    }));

    return {
      snapshotAt: Date.now(),
      densityZones,
      disruptions,
    };
  } catch {
    return undefined;
  }
}

// ========================================================================
// RPC handler
// ========================================================================

export async function getVesselSnapshot(
  ctx: ServerContext,
  _req: GetVesselSnapshotRequest,
): Promise<GetVesselSnapshotResponse> {
  try {
    let refresh = false;
    try {
      const url = new URL(ctx.request.url);
      refresh = url.searchParams.get('refresh') === '1' || url.searchParams.get('prefer_live') === '1';
    } catch {
      refresh = false;
    }
    return await fetchVesselSnapshot(refresh);
  } catch {
    return buildUnavailableResponse();
  }
}
