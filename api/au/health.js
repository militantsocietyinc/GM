/**
 * AU Source Health API Route
 *
 * Returns the health/availability status of all AU data sources.
 * Useful for the dashboard status panel and monitoring.
 *
 * Vercel Edge Function — no caching (real-time health).
 */

import { getCorsHeaders, isDisallowedOrigin } from '../_cors.js';

export const config = { runtime: 'edge' };

const AU_SOURCES = [
  { id: 'nsw-livetraffic', name: 'NSW Live Traffic', probe: 'https://api.transport.nsw.gov.au/v1/live/hazards/incident/open', authHeader: 'TFNSW_API_KEY' },
  { id: 'bom-warnings', name: 'BOM Warnings', probe: 'http://www.bom.gov.au/fwo/IDN11060.xml' },
  { id: 'nsw-rfs', name: 'NSW RFS Bushfires', probe: 'https://feeds.nsw.gov.au/data/major-fire-update.json' },
  { id: 'ga-earthquakes', name: 'GA Earthquakes', probe: 'https://earthquakes.ga.gov.au/quakes/quake.json' },
  { id: 'usgs-au', name: 'USGS (AU bbox)', probe: 'https://earthquake.usgs.gov/fdsnws/event/1/count?format=geojson&minlatitude=-44&maxlatitude=-10&minlongitude=112&maxlongitude=154' },
];

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders(req) });
  }
  if (isDisallowedOrigin(req)) {
    return new Response('Forbidden', { status: 403 });
  }

  const results = await Promise.allSettled(
    AU_SOURCES.map(async (src) => {
      const start = Date.now();
      try {
        const headers = {};
        if (src.authHeader && process.env[src.authHeader]) {
          headers['Authorization'] = `apikey ${process.env[src.authHeader]}`;
        }
        const res = await fetch(src.probe, {
          method: 'HEAD',
          headers,
          signal: AbortSignal.timeout(5_000),
        });
        return {
          id: src.id,
          name: src.name,
          status: res.ok ? 'ok' : 'error',
          httpStatus: res.status,
          latencyMs: Date.now() - start,
        };
      } catch (err) {
        return {
          id: src.id,
          name: src.name,
          status: 'error',
          error: err.message,
          latencyMs: Date.now() - start,
        };
      }
    })
  );

  const sources = results.map(r => r.status === 'fulfilled' ? r.value : { status: 'error', error: 'Promise rejected' });

  return new Response(JSON.stringify({
    ok: sources.every(s => s.status === 'ok'),
    sources,
    checkedAt: new Date().toISOString(),
  }), {
    headers: {
      ...getCorsHeaders(req),
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
