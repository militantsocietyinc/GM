export type FreshnessStatus = 'live' | 'cached' | 'stale' | 'unavailable' | 'loading';

const COLORS: Record<FreshnessStatus, string> = {
  live: '#22c55e',
  cached: '#eab308',
  stale: '#f97316',
  unavailable: '#ef4444',
  loading: '#6b7280',
};

function formatAge(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 0) return 'now';
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function createDataFreshnessIndicator(status: FreshnessStatus, lastUpdated?: string | null): HTMLSpanElement {
  const span = document.createElement('span');
  span.setAttribute('role', 'status');
  span.setAttribute('aria-label', `Data status: ${status}`);
  span.title = lastUpdated ? `Last updated: ${formatAge(lastUpdated)}` : status;
  span.style.cssText = 'display:inline-flex;align-items:center;gap:4px;font-size:0.75em;opacity:0.8;';

  const dot = document.createElement('span');
  dot.style.cssText = `width:6px;height:6px;border-radius:50%;background-color:${COLORS[status]};display:inline-block;`;
  span.appendChild(dot);

  const label = lastUpdated && status !== 'loading' ? `${status} (${formatAge(lastUpdated)})` : status;
  span.appendChild(document.createTextNode(label));

  return span;
}
