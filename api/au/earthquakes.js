/**
 * AU Earthquakes API Route
 *
 * Proxies Geoscience Australia earthquake data + USGS events
 * filtered to Australian bbox.
 *
 * Vercel Edge Function — caches for 5 minutes.
 */

import { getCorsHeaders, isDisallowedOrigin } from '../_cors.js';

export const config = { runtime: 'edge' };

const GA_URL = 'https://earthquakes.ga.gov.au/quakes/quake.json';
const USGS_URL = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minlatitude=-44&maxlatitude=-10&minlongitude=112&maxlongitude=154&orderby=time&limit=50';

const CACHE_TTL = 300; // 5 minutes

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders(req) });
  }
  if (isDisallowedOrigin(req)) {
    return new Response('Forbidden', { status: 403 });
  }

  try {
    const [gaRes, usgsRes] = await Promise.allSettled([
      fetch(GA_URL, { signal: AbortSignal.timeout(10_000) }),
      fetch(USGS_URL, { signal: AbortSignal.timeout(10_000) }),
    ]);

    const features = [];
    const seenIds = new Set();

    // GA data (primary for AU)
    if (gaRes.status === 'fulfilled' && gaRes.value.ok) {
      try {
        const gaData = await gaRes.value.json();
        for (const f of (gaData?.features || gaData || [])) {
          const id = f.properties?.eventId || f.id;
          if (id) seenIds.add(id);
          features.push({ ...f, properties: { ...f.properties, _source: 'ga' } });
        }
      } catch { /* skip */ }
    }

    // USGS supplement (secondary — avoid duplicates)
    if (usgsRes.status === 'fulfilled' && usgsRes.value.ok) {
      try {
        const usgsData = await usgsRes.value.json();
        for (const f of (usgsData?.features || [])) {
          const id = f.id || f.properties?.code;
          if (id && seenIds.has(id)) continue;
          features.push({ ...f, properties: { ...f.properties, _source: 'usgs' } });
        }
      } catch { /* skip */ }
    }

    const geojson = {
      type: 'FeatureCollection',
      features,
      _meta: {
        fetchedAt: new Date().toISOString(),
        count: features.length,
      },
    };

    return new Response(JSON.stringify(geojson), {
      headers: {
        ...getCorsHeaders(req),
        'Content-Type': 'application/json',
        'Cache-Control': `public, s-maxage=${CACHE_TTL}, stale-while-revalidate=120`,
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 502,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });
  }
}
