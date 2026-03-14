#!/usr/bin/env node

/**
 * Seed military, maritime, and news data to Redis.
 *
 * Seedable:
 * - USNI Fleet Report (WordPress JSON API scrape)
 * - Navigational Warnings (NGA broadcast API, default "all" area)
 *
 * NOT seeded (inherently on-demand):
 * - getAircraftDetails / batch: per-icao24 Wingbits lookup
 * - listMilitaryFlights: bounding-box query (quantized grid)
 * - getVesselSnapshot: in-memory cache, reads from relay /ais-snapshot
 * - listFeedDigest: per-feed URL RSS caching (hundreds of feeds)
 * - summarizeArticle: per-article LLM summarization
 */

import { loadEnvFile, CHROME_UA, runSeed, writeExtraKey } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const USNI_CACHE_KEY = 'usni-fleet:sebuf:v1';
const USNI_STALE_KEY = 'usni-fleet:sebuf:stale:v1';
const USNI_TTL = 21600;
const USNI_STALE_TTL = 86400 * 7;

const NAV_CACHE_KEY = 'maritime:navwarnings:v1:all';
const NAV_TTL = 3600;

// ─── USNI Fleet Report ───

function stripHtml(html) {
  return (html || '').replace(/<[^>]+>/g, '').trim();
}

function parseUSNIArticle(html, articleUrl, articleDate, articleTitle) {
  const vessels = [];
  const strikeGroups = [];
  const regions = [];
  const warnings = [];

  // Extract vessel entries from article HTML
  const vesselPattern = /<strong>USS\s+([^<]+)<\/strong>/gi;
  let match;
  while ((match = vesselPattern.exec(html)) !== null) {
    const name = match[1].trim();
    const hullMatch = name.match(/\(([A-Z]+-\d+)\)/);
    vessels.push({
      name: name.replace(/\s*\([^)]*\)\s*/, '').trim(),
      hullNumber: hullMatch?.[1] || '',
      type: hullMatch?.[1]?.startsWith('CVN') ? 'carrier' :
            hullMatch?.[1]?.startsWith('DDG') ? 'destroyer' :
            hullMatch?.[1]?.startsWith('CG') ? 'cruiser' :
            hullMatch?.[1]?.startsWith('LH') ? 'amphibious' : 'other',
      region: '',
      status: 'deployed',
    });
  }

  // Extract CSG/ARG mentions
  const csgPattern = /(?:Carrier Strike Group|CSG)\s*(\d+)/gi;
  while ((match = csgPattern.exec(html)) !== null) {
    strikeGroups.push({ name: `CSG ${match[1]}`, type: 'csg' });
  }
  const argPattern = /(?:Amphibious Ready Group|ARG)/gi;
  while ((match = argPattern.exec(html)) !== null) {
    strikeGroups.push({ name: 'ARG', type: 'arg' });
  }

  // Extract region mentions
  const regionKeywords = [
    'Mediterranean', 'Indo-Pacific', 'Middle East', 'South China Sea',
    'Red Sea', 'Pacific', 'Atlantic', 'Persian Gulf', 'Arabian Sea',
    'Western Pacific', 'Eastern Mediterranean', 'Baltic',
  ];
  for (const region of regionKeywords) {
    if (html.includes(region)) regions.push(region);
  }

  return {
    articleUrl, articleDate, articleTitle,
    vessels, strikeGroups, regions,
    vesselCount: vessels.length,
    lastUpdated: new Date().toISOString(),
    parsingWarnings: warnings,
  };
}

async function fetchUSNIReport() {
  const resp = await fetch(
    'https://news.usni.org/wp-json/wp/v2/posts?categories=4137&per_page=1',
    {
      headers: { Accept: 'application/json', 'User-Agent': CHROME_UA },
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!resp.ok) throw new Error(`USNI HTTP ${resp.status}`);
  const wpData = await resp.json();
  if (!Array.isArray(wpData) || wpData.length === 0) throw new Error('No USNI fleet articles');

  const post = wpData[0];
  const articleUrl = post.link || `https://news.usni.org/?p=${post.id}`;
  const articleDate = post.date || new Date().toISOString();
  const articleTitle = stripHtml(post.title?.rendered || 'USNI Fleet Tracker');
  const htmlContent = post.content?.rendered || '';
  if (!htmlContent) throw new Error('USNI article has no content');

  const report = parseUSNIArticle(htmlContent, articleUrl, articleDate, articleTitle);
  console.log(`  USNI Fleet: ${report.vessels.length} vessels, ${report.strikeGroups.length} groups, ${report.regions.length} regions`);
  return report;
}

// ─── Navigational Warnings (NGA) ───

async function fetchNavWarnings() {
  const resp = await fetch(
    'https://msi.nga.mil/api/publications/broadcast-warn?output=json&status=A',
    {
      headers: { Accept: 'application/json', 'User-Agent': CHROME_UA },
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!resp.ok) throw new Error(`NGA HTTP ${resp.status}`);
  const data = await resp.json();
  const records = data?.broadcast_warn || data || [];
  if (!Array.isArray(records)) throw new Error('NGA response not an array');

  const parseNgaDate = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return 0;
    const match = dateStr.match(/(\d{2})(\d{4})Z\s+([A-Z]{3})\s+(\d{4})/i);
    if (!match) return Date.parse(dateStr) || 0;
    const months = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
    const day = parseInt(match[1], 10);
    const hours = parseInt(match[2].slice(0, 2), 10);
    const minutes = parseInt(match[2].slice(2, 4), 10);
    const month = months[match[3].toUpperCase()] ?? 0;
    const year = parseInt(match[4], 10);
    return new Date(Date.UTC(year, month, day, hours, minutes)).getTime();
  };

  const warnings = records.slice(0, 200).map(r => {
    const text = String(r.text || r.details || '');
    const area = String(r.navArea || r.area || '');
    return {
      id: String(r.msgNumber || r.id || `nga-${Date.now()}-${Math.random()}`),
      text: text.slice(0, 500),
      area,
      issuedAt: parseNgaDate(r.dateIssued || r.issuedDate || r.dtg),
      expiresAt: parseNgaDate(r.dateCancel || r.cancelDate),
      source: 'NGA',
      warningType: String(r.warningType || r.type || ''),
      authority: String(r.authority || 'NGA'),
    };
  }).filter(w => w.text.length > 0);

  console.log(`  Nav warnings: ${warnings.length} active`);
  return { warnings, pagination: undefined };
}

// ─── Main ───

let allData = null;

async function fetchAll() {
  const [usni, navWarnings] = await Promise.allSettled([
    fetchUSNIReport(),
    fetchNavWarnings(),
  ]);

  allData = {
    usni: usni.status === 'fulfilled' ? usni.value : null,
    navWarnings: navWarnings.status === 'fulfilled' ? navWarnings.value : null,
  };

  if (!allData.usni && !allData.navWarnings) throw new Error('All military/maritime fetches failed');
  return allData.usni || {};
}

function validate() {
  return allData?.usni || allData?.navWarnings?.warnings?.length > 0;
}

runSeed('military', 'usni-navwarn', USNI_CACHE_KEY, fetchAll, {
  validateFn: validate,
  ttlSeconds: USNI_TTL,
  sourceVersion: 'usni-nga',
}).then(async (result) => {
  if (result?.skipped || !allData) return;

  // USNI stale backup
  if (allData.usni) {
    await writeExtraKey(USNI_STALE_KEY, allData.usni, USNI_STALE_TTL);
  }

  // Nav warnings
  if (allData.navWarnings?.warnings?.length > 0) {
    await writeExtraKey(NAV_CACHE_KEY, allData.navWarnings, NAV_TTL);
  }
}).catch((err) => {
  console.error('FATAL:', err.message || err);
  process.exit(1);
});
