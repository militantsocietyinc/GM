/**
 * AU Transport Disruptions API Route
 *
 * Aggregates public transit disruption data from state agencies.
 * MVP: TfNSW alerts (has the best public API).
 *
 * Vercel Edge Function — caches for 3 minutes.
 */

import { getCorsHeaders, isDisallowedOrigin } from '../_cors.js';

export const config = { runtime: 'edge' };

const CACHE_TTL = 180;

// TfNSW GTFS-RT alerts converted to JSON
const TFNSW_ALERTS_URL = 'https://api.transport.nsw.gov.au/v2/gtfs/alerts';

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders(req) });
  }
  if (isDisallowedOrigin(req)) {
    return new Response('Forbidden', { status: 403 });
  }

  try {
    const apiKey = process.env.TFNSW_API_KEY || '';
    const alerts = [];

    if (apiKey) {
      const res = await fetch(TFNSW_ALERTS_URL, {
        headers: { Authorization: `apikey ${apiKey}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });

      if (res.ok) {
        const data = await res.json();
        // GTFS-RT format: entity[] with alert objects
        const entities = data?.entity || data?.alerts || [];
        for (const e of entities) {
          const alert = e.alert || e;
          alerts.push({
            id: e.id || Math.random().toString(36).slice(2),
            header: alert.header_text?.translation?.[0]?.text || alert.header || '',
            description: alert.description_text?.translation?.[0]?.text || alert.description || '',
            url: alert.url?.translation?.[0]?.text || '',
            start: alert.active_period?.[0]?.start ? new Date(alert.active_period[0].start * 1000).toISOString() : null,
            end: alert.active_period?.[0]?.end ? new Date(alert.active_period[0].end * 1000).toISOString() : null,
            route_type: alert.informed_entity?.[0]?.route_type || '',
            route_name: alert.informed_entity?.[0]?.route_id || '',
            severity: alert.severity_level || 'unknown',
            state: 'NSW',
            active: true,
          });
        }
      }
    }

    return new Response(JSON.stringify({ alerts, _meta: { fetchedAt: new Date().toISOString(), count: alerts.length } }), {
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
