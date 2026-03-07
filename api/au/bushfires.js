/**
 * AU Bushfires API Route
 *
 * Proxies and aggregates bushfire data from state emergency services.
 * MVP: NSW RFS GeoJSON feed (most reliable, best-documented).
 *
 * Vercel Edge Function — caches for 3 minutes.
 */

import { getCorsHeaders, isDisallowedOrigin } from '../_cors.js';

export const config = { runtime: 'edge' };

const NSW_RFS_FEED = 'https://feeds.nsw.gov.au/data/major-fire-update.json';
const VIC_EMERGENCY_FEED = 'https://emergency.vic.gov.au/public/osom-geojson.json';

const CACHE_TTL = 180; // 3 minutes

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders(req) });
  }
  if (isDisallowedOrigin(req)) {
    return new Response('Forbidden', { status: 403 });
  }

  try {
    // Fetch NSW and VIC in parallel
    const [nswRes, vicRes] = await Promise.allSettled([
      fetch(NSW_RFS_FEED, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      }),
      fetch(VIC_EMERGENCY_FEED, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      }),
    ]);

    const features = [];

    // Parse NSW RFS
    if (nswRes.status === 'fulfilled' && nswRes.value.ok) {
      try {
        const nswData = await nswRes.value.json();
        const nswFeatures = (nswData?.features || []).map(f => ({
          ...f,
          properties: { ...f.properties, _source: 'nsw-rfs', state: 'NSW' },
        }));
        features.push(...nswFeatures);
      } catch { /* skip malformed */ }
    }

    // Parse VIC Emergency
    if (vicRes.status === 'fulfilled' && vicRes.value.ok) {
      try {
        const vicData = await vicRes.value.json();
        // VIC emergency feed includes fires + other events; filter to fires
        const vicFeatures = (vicData?.features || [])
          .filter(f => {
            const cat = (f.properties?.category1 || f.properties?.feedType || '').toLowerCase();
            return cat.includes('fire') || cat.includes('burn') || cat.includes('bushfire');
          })
          .map(f => ({
            ...f,
            properties: { ...f.properties, _source: 'vic-emergency', state: 'VIC' },
          }));
        features.push(...vicFeatures);
      } catch { /* skip malformed */ }
    }

    const geojson = {
      type: 'FeatureCollection',
      features,
      _meta: {
        fetchedAt: new Date().toISOString(),
        sources: ['nsw-rfs', 'vic-emergency'],
        count: features.length,
      },
    };

    return new Response(JSON.stringify(geojson), {
      headers: {
        ...getCorsHeaders(req),
        'Content-Type': 'application/json',
        'Cache-Control': `public, s-maxage=${CACHE_TTL}, stale-while-revalidate=60`,
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 502,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });
  }
}
