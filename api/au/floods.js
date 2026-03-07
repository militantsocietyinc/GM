/**
 * AU Flood Warnings API Route
 *
 * Proxies BOM flood warning feeds.
 * Similar pattern to bom-warnings but focused on flood products.
 *
 * Vercel Edge Function — caches for 5 minutes.
 */

import { getCorsHeaders, isDisallowedOrigin } from '../_cors.js';

export const config = { runtime: 'edge' };

// BOM flood warning feeds per state
const FLOOD_FEEDS = {
  NSW: 'http://www.bom.gov.au/fwo/IDN36400.xml',
  VIC: 'http://www.bom.gov.au/fwo/IDV36300.xml',
  QLD: 'http://www.bom.gov.au/fwo/IDQ36600.xml',
  SA:  'http://www.bom.gov.au/fwo/IDS36400.xml',
  WA:  'http://www.bom.gov.au/fwo/IDW36500.xml',
  TAS: 'http://www.bom.gov.au/fwo/IDT36100.xml',
  NT:  'http://www.bom.gov.au/fwo/IDD36200.xml',
};

const CACHE_TTL = 300;

function parseFloodItems(xml, state) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/)?.[1] || block.match(/<title>(.*?)<\/title>/)?.[1] || '';
    const desc = block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description>([\s\S]*?)<\/description>/)?.[1] || '';
    const link = block.match(/<link>(.*?)<\/link>/)?.[1] || '';
    const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';

    if (title) {
      const lc = title.toLowerCase();
      let severity = 'unknown';
      if (lc.includes('major')) severity = 'major';
      else if (lc.includes('moderate')) severity = 'moderate';
      else if (lc.includes('minor')) severity = 'minor';

      items.push({
        id: `flood-${state}-${Buffer.from(title).toString('base64').slice(0, 16)}`,
        title: title.trim(),
        description: desc.trim().replace(/<[^>]+>/g, ''),
        web: link.trim(),
        state,
        issued: pubDate,
        severity,
        type: lc.includes('flash') ? 'flash-flood' : lc.includes('coastal') ? 'coastal' : 'riverine',
      });
    }
  }

  return items;
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders(req) });
  }
  if (isDisallowedOrigin(req)) {
    return new Response('Forbidden', { status: 403 });
  }

  try {
    const entries = Object.entries(FLOOD_FEEDS);
    const results = await Promise.allSettled(
      entries.map(([state, url]) =>
        fetch(url, { signal: AbortSignal.timeout(8_000) })
          .then(async r => {
            if (!r.ok) return [];
            const xml = await r.text();
            return parseFloodItems(xml, state);
          })
      )
    );

    const warnings = [];
    results.forEach(r => {
      if (r.status === 'fulfilled') warnings.push(...r.value);
    });

    return new Response(JSON.stringify({ warnings, _meta: { fetchedAt: new Date().toISOString(), count: warnings.length } }), {
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
