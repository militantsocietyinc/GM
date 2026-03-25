export type SourceMode = 'live' | 'cached' | 'fallback' | 'unavailable';

export interface DataProvenance {
  fetchedAt?: string | null;
  cached?: boolean;
  upstreamUnavailable?: boolean;
  sourceMode?: string | null;
  fallback?: boolean;
}

export type ProvenanceFreshness = 'fresh' | 'stale' | 'very_stale' | null;

const STALE_AFTER_MS = 2 * 60 * 60 * 1000;
const VERY_STALE_AFTER_MS = 6 * 60 * 60 * 1000;

export function getProvenanceFreshness(
  fetchedAt?: string | null,
  nowMs = Date.now(),
): ProvenanceFreshness {
  if (!fetchedAt) return null;
  const parsedMs = Date.parse(fetchedAt);
  if (!Number.isFinite(parsedMs)) return null;
  const ageMs = Math.max(0, nowMs - parsedMs);
  if (ageMs >= VERY_STALE_AFTER_MS) return 'very_stale';
  if (ageMs >= STALE_AFTER_MS) return 'stale';
  return 'fresh';
}

export function normalizeSourceMode(
  provenance: DataProvenance,
  hasData: boolean,
): SourceMode {
  if (provenance.sourceMode === 'live'
    || provenance.sourceMode === 'cached'
    || provenance.sourceMode === 'fallback'
    || provenance.sourceMode === 'unavailable') {
    return provenance.sourceMode;
  }
  if (provenance.fallback) return 'fallback';
  if (provenance.upstreamUnavailable && !hasData) return 'unavailable';
  if (provenance.cached) return 'cached';
  return 'live';
}

function formatTimestamp(fetchedAt?: string | null): string {
  if (!fetchedAt) return '';
  const parsed = new Date(fetchedAt);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString();
}

export interface ProvenanceDescriptor {
  mode: SourceMode;
  label: string;
  detail: string;
  freshness: ProvenanceFreshness;
}

export function describeDataProvenance(
  provenance: DataProvenance,
  options?: {
    hasData?: boolean;
    updatedLabel?: string;
  },
): ProvenanceDescriptor {
  const hasData = options?.hasData ?? false;
  const mode = normalizeSourceMode(provenance, hasData);
  const freshness = getProvenanceFreshness(provenance.fetchedAt);
  const updatedAt = formatTimestamp(provenance.fetchedAt);

  const label = mode === 'cached'
    ? 'Cached'
    : mode === 'fallback'
      ? 'Fallback'
      : mode === 'unavailable'
        ? 'Unavailable'
        : 'Live';

  const detailParts: string[] = [];
  if (provenance.upstreamUnavailable && hasData) {
    detailParts.push('Upstream unavailable');
  }
  if (freshness === 'very_stale') detailParts.push('Very stale');
  else if (freshness === 'stale') detailParts.push('Stale');
  if (updatedAt) detailParts.push(`${options?.updatedLabel ?? 'Updated'} ${updatedAt}`);

  return {
    mode,
    label,
    detail: detailParts.join(' • '),
    freshness,
  };
}

export function renderDataProvenanceHtml(
  provenance: DataProvenance,
  options?: {
    hasData?: boolean;
    updatedLabel?: string;
    compact?: boolean;
  },
): string {
  const descriptor = describeDataProvenance(provenance, options);
  const compactClass = options?.compact ? ' data-provenance-compact' : '';
  const detailHtml = descriptor.detail
    ? `<span class="data-provenance-detail">${descriptor.detail}</span>`
    : '';

  return `<div class="data-provenance${compactClass}">
    <span class="data-provenance-badge data-provenance-${descriptor.mode}">${descriptor.label}</span>
    ${detailHtml}
  </div>`;
}
