/**
 * AU BOM Weather Warnings API Route
 *
 * Proxies Bureau of Meteorology warning data.
 * BOM doesn't provide a clean JSON API — this parses the
 * CAP/RSS feeds and returns normalized JSON.
 *
 * Vercel Edge Function — caches for 5 minutes.
 */

import { getCorsHeaders, isDisallowedOrigin } from '../_cors.js';

export const config = { runtime: 'edge' };

// BOM warning summary JSON (unofficial but stable)
const BOM_WARNINGS_JSON = 'http://www.bom.gov.au/fwo/IDZ00060.warnings_land_nsw.xml';

// BOM provides state-level RSS feeds — these are more accessible
const STATE_FEEDS = {
  NSW: 'http://www.bom.gov.au/fwo/IDN11060.xml',
  VIC: 'http://www.bom.gov.au/fwo/IDV10750.xml',
  QLD: 'http://www.bom.gov.au/fwo/IDQ20885.xml',
  SA:  'http://www.bom.gov.au/fwo/IDS11055.xml',
  WA:  'http://www.bom.gov.au/fwo/IDW21035.xml',
  TAS: 'http://www.bom.gov.au/fwo/IDT13600.xml',
  NT:  'http://www.bom.gov.au/fwo/IDD11035.xml',
};

const CACHE_TTL = 300; // 5 minutes

/**
 * Simple XML text extraction (avoids heavy XML parser dependency in edge runtime).
 * Extracts <item> elements from RSS feeds.
 */
function parseRssItems(xml, state) {
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
      items.push({
        id: `bom-${state}-${Buffer.from(title).toString('base64').slice(0, 16)}`,
        title: title.trim(),
        description: desc.trim().replace(/<[^>]+>/g, ''),
        web: link.trim(),
        state,
        issued: pubDate,
        severity: guessSeverity(title),
      });
    }
  }

  return items;
}

function guessSeverity(title) {
  const lc = title.toLowerCase();
  if (lc.includes('emergency') || lc.includes('extreme')) return 'extreme';
  if (lc.includes('severe') || lc.includes('warning')) return 'major';
  if (lc.includes('watch')) return 'moderate';
  if (lc.includes('advice') || lc.includes('information')) return 'minor';
  return 'unknown';
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders(req) });
  }
  if (isDisallowedOrigin(req)) {
    return new Response('Forbidden', { status: 403 });
  }

  try {
    // Fetch all state warning feeds in parallel
    const entries = Object.entries(STATE_FEEDS);
    const results = await Promise.allSettled(
      entries.map(([state, url]) =>
        fetch(url, { signal: AbortSignal.timeout(8_000) })
          .then(async r => {
            if (!r.ok) return [];
            const xml = await r.text();
            return parseRssItems(xml, state);
          })
      )
    );

    const warnings = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        warnings.push(...r.value);
      }
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
