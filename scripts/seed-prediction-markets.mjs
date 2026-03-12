#!/usr/bin/env node

import { loadEnvFile, CHROME_UA, sleep, runSeed } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'prediction:markets-bootstrap:v1';
const CACHE_TTL = 900; // 15 min — matches client poll interval

const GAMMA_BASE = 'https://gamma-api.polymarket.com';
const FETCH_TIMEOUT = 10_000;
const TAG_DELAY_MS = 300;

const GEOPOLITICAL_TAGS = [
  'politics', 'geopolitics', 'elections', 'world',
  'ukraine', 'china', 'middle-east', 'europe',
  'economy', 'fed', 'inflation',
];

const TECH_TAGS = [
  'ai', 'tech', 'crypto', 'science',
  'elon-musk', 'business', 'economy',
];

const FINANCE_TAGS = [
  'economy', 'fed', 'inflation', 'interest-rates', 'recession',
  'trade', 'tariffs', 'debt-ceiling',
];

const EXCLUDE_KEYWORDS = [
  'nba', 'nfl', 'mlb', 'nhl', 'fifa', 'world cup', 'super bowl', 'championship',
  'playoffs', 'oscar', 'grammy', 'emmy', 'box office', 'movie', 'album', 'song',
  'streamer', 'influencer', 'celebrity', 'kardashian',
  'bachelor', 'reality tv', 'mvp', 'touchdown', 'home run', 'goal scorer',
  'academy award', 'bafta', 'golden globe', 'cannes', 'sundance',
  'documentary', 'feature film', 'tv series', 'season finale',
];

const MEME_PATTERNS = [
  /\b(lebron|kanye|oprah|swift|rogan|dwayne|kardashian|cardi\s*b)\b/i,
  /\b(alien|ufo|zombie|flat earth)\b/i,
];

const REGION_PATTERNS = {
  america: /\b(us|u\.s\.|united states|america|trump|biden|congress|federal reserve|canada|mexico|brazil)\b/i,
  eu: /\b(europe|european|eu|nato|germany|france|uk|britain|macron|ecb)\b/i,
  mena: /\b(middle east|iran|iraq|syria|israel|palestine|gaza|saudi|yemen|houthi|lebanon)\b/i,
  asia: /\b(china|japan|korea|india|taiwan|xi jinping|asean)\b/i,
  latam: /\b(latin america|brazil|argentina|venezuela|colombia|chile)\b/i,
  africa: /\b(africa|nigeria|south africa|ethiopia|sahel|kenya)\b/i,
  oceania: /\b(australia|new zealand)\b/i,
};

function isExcluded(title) {
  const lower = title.toLowerCase();
  return EXCLUDE_KEYWORDS.some(kw => lower.includes(kw));
}

function isMemeCandidate(title, yesPrice) {
  if (yesPrice >= 15) return false;
  return MEME_PATTERNS.some(p => p.test(title));
}

function tagRegions(title) {
  return Object.entries(REGION_PATTERNS)
    .filter(([, re]) => re.test(title))
    .map(([region]) => region);
}

function parseYesPrice(market) {
  try {
    const prices = JSON.parse(market.outcomePrices || '[]');
    if (prices.length >= 1) {
      const p = parseFloat(prices[0]);
      if (!isNaN(p) && p >= 0 && p <= 1) return +(p * 100).toFixed(1);
    }
  } catch {}
  return null;
}

function shouldInclude(m, relaxed = false) {
  const minPrice = relaxed ? 5 : 10;
  const maxPrice = relaxed ? 95 : 90;
  if (m.yesPrice < minPrice || m.yesPrice > maxPrice) return false;
  if (m.volume < 5000) return false;
  if (isExcluded(m.title)) return false;
  if (isMemeCandidate(m.title, m.yesPrice)) return false;
  return true;
}

function scoreMarket(m) {
  const uncertainty = 1 - (2 * Math.abs(m.yesPrice - 50) / 100);
  const vol = Math.log10(Math.max(m.volume, 1)) / Math.log10(10_000_000);
  return (uncertainty * 0.6) + (Math.min(vol, 1) * 0.4);
}

function filterAndScore(candidates, tagFilter, limit = 25) {
  let filtered = candidates.filter(m => !isExpired(m.endDate));
  if (tagFilter) filtered = filtered.filter(tagFilter);

  let result = filtered.filter(m => shouldInclude(m));
  if (result.length < 15) {
    console.log(`  relaxing price bounds (${result.length} markets with strict filter)`);
    result = filtered.filter(m => shouldInclude(m, true));
  }

  return result
    .map(m => ({ ...m, regions: tagRegions(m.title) }))
    .sort((a, b) => scoreMarket(b) - scoreMarket(a))
    .slice(0, limit);
}

function isExpired(endDate) {
  if (!endDate) return false;
  const ms = Date.parse(endDate);
  return Number.isFinite(ms) && ms < Date.now();
}

async function fetchEventsByTag(tag, limit = 20) {
  const params = new URLSearchParams({
    tag_slug: tag,
    closed: 'false',
    active: 'true',
    archived: 'false',
    end_date_min: new Date().toISOString(),
    order: 'volume',
    ascending: 'false',
    limit: String(limit),
  });

  const resp = await fetch(`${GAMMA_BASE}/events?${params}`, {
    headers: { Accept: 'application/json', 'User-Agent': CHROME_UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });
  if (!resp.ok) {
    console.warn(`  [${tag}] HTTP ${resp.status}`);
    return [];
  }
  const data = await resp.json();
  return Array.isArray(data) ? data : [];
}

async function fetchAllPredictions() {
  const allTags = [...new Set([...GEOPOLITICAL_TAGS, ...TECH_TAGS, ...FINANCE_TAGS])];
  const seen = new Set();
  const markets = [];

  for (const tag of allTags) {
    try {
      const events = await fetchEventsByTag(tag, 20);
      console.log(`  [${tag}] ${events.length} events`);

      for (const event of events) {
        if (event.closed || seen.has(event.id)) continue;
        seen.add(event.id);
        if (isExcluded(event.title)) continue;

        const eventVolume = event.volume ?? 0;
        if (eventVolume < 1000) continue;

        if (event.markets?.length > 0) {
          const active = event.markets.filter(m => !m.closed && !isExpired(m.endDate));
          if (active.length === 0) continue;

          const topMarket = active.reduce((best, m) => {
            const vol = m.volumeNum ?? (m.volume ? parseFloat(m.volume) : 0);
            const bestVol = best.volumeNum ?? (best.volume ? parseFloat(best.volume) : 0);
            return vol > bestVol ? m : best;
          });

          const yesPrice = parseYesPrice(topMarket);
          if (yesPrice === null) continue;

          markets.push({
            title: topMarket.question || event.title,
            yesPrice,
            volume: eventVolume,
            url: `https://polymarket.com/event/${event.slug}`,
            endDate: topMarket.endDate ?? event.endDate ?? undefined,
            tags: (event.tags ?? []).map(t => t.slug),
          });
        } else {
          continue; // no markets = no price signal, skip
        }
      }
    } catch (err) {
      console.warn(`  [${tag}] error: ${err.message}`);
    }
    await sleep(TAG_DELAY_MS);
  }

  console.log(`  total raw markets: ${markets.length}`);

  const geopolitical = filterAndScore(markets, null);
  const tech = filterAndScore(markets, m => m.tags?.some(t => TECH_TAGS.includes(t)));
  const finance = filterAndScore(markets, m => m.tags?.some(t => FINANCE_TAGS.includes(t)));

  console.log(`  geopolitical: ${geopolitical.length}, tech: ${tech.length}, finance: ${finance.length}`);

  return {
    geopolitical,
    tech,
    finance,
    fetchedAt: Date.now(),
  };
}

await runSeed('prediction', 'markets', CANONICAL_KEY, fetchAllPredictions, {
  ttlSeconds: CACHE_TTL,
  lockTtlMs: 60_000,
  validateFn: (data) => (data?.geopolitical?.length > 0 || data?.tech?.length > 0) && data?.finance?.length > 0,
});
