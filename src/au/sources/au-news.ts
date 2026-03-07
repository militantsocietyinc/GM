/**
 * Australian News — RSS Feed Aggregation
 *
 * Reuses the existing worldmonitor RSS infrastructure (src/services/rss.ts)
 * with AU-specific feed list.
 *
 * Integration difficulty: Easy
 * - Same pattern as existing feeds.ts
 * - Just needs AU-specific feed URLs
 * - Existing clustering, threat classification, and geo-tagging all apply
 */

import type { Feed } from '@/types';

/**
 * Australian news RSS feeds, categorised by type.
 * These will be merged into the main feed system via the australia variant.
 */
export const AU_NEWS_FEEDS: Record<string, Feed[]> = {
  // ── National News ─────────────────────────────────────
  national: [
    { name: 'ABC News', url: 'https://www.abc.net.au/news/feed/2942460/rss.xml', region: 'AU' },
    { name: 'ABC News Top Stories', url: 'https://www.abc.net.au/news/feed/51120/rss.xml', region: 'AU' },
    { name: 'SBS News', url: 'https://www.sbs.com.au/news/feed', region: 'AU' },
    { name: 'The Guardian AU', url: 'https://www.theguardian.com/au/rss', region: 'AU' },
    { name: 'Sydney Morning Herald', url: 'https://www.smh.com.au/rss/feed.xml', region: 'AU' },
    { name: 'The Age', url: 'https://www.theage.com.au/rss/feed.xml', region: 'AU' },
    { name: 'News.com.au', url: 'https://www.news.com.au/content-feeds/latest-news-national/', region: 'AU' },
    { name: 'The Australian', url: 'https://www.theaustralian.com.au/feed', region: 'AU' },
    { name: 'The Conversation AU', url: 'https://theconversation.com/au/articles.atom', region: 'AU' },
    { name: 'Crikey', url: 'https://www.crikey.com.au/feed/', region: 'AU' },
    { name: 'Sky News AU', url: 'https://www.skynews.com.au/feeds/rss/', region: 'AU' },
  ],

  // ── State/Regional ──────────────────────────────────────
  nsw: [
    { name: 'ABC Sydney', url: 'https://www.abc.net.au/news/feed/8057540/rss.xml', region: 'NSW' },
    { name: 'Daily Telegraph', url: 'https://www.dailytelegraph.com.au/news/nsw/rss', region: 'NSW' },
  ],
  vic: [
    { name: 'ABC Melbourne', url: 'https://www.abc.net.au/news/feed/8057474/rss.xml', region: 'VIC' },
    { name: 'Herald Sun', url: 'https://www.heraldsun.com.au/news/victoria/rss', region: 'VIC' },
  ],
  qld: [
    { name: 'ABC Brisbane', url: 'https://www.abc.net.au/news/feed/8057334/rss.xml', region: 'QLD' },
    { name: 'Courier Mail', url: 'https://www.couriermail.com.au/news/queensland/rss', region: 'QLD' },
  ],
  wa: [
    { name: 'ABC Perth', url: 'https://www.abc.net.au/news/feed/8057570/rss.xml', region: 'WA' },
    { name: 'WAtoday', url: 'https://www.watoday.com.au/rss/feed.xml', region: 'WA' },
  ],
  sa: [
    { name: 'ABC Adelaide', url: 'https://www.abc.net.au/news/feed/8057266/rss.xml', region: 'SA' },
    { name: 'The Advertiser', url: 'https://www.adelaidenow.com.au/rss', region: 'SA' },
  ],

  // ── Emergency / Specialist ──────────────────────────────
  emergency: [
    { name: 'ABC Emergency', url: 'https://www.abc.net.au/news/feed/8413500/rss.xml', region: 'AU' },
    { name: 'BOM Warnings', url: 'http://www.bom.gov.au/fwo/IDZ00060.warnings_land_nsw.xml', region: 'AU' },
  ],

  // ── Business / Economy ──────────────────────────────────
  business: [
    { name: 'AFR', url: 'https://www.afr.com/rss/feed.xml', region: 'AU' },
    { name: 'ABC Business', url: 'https://www.abc.net.au/news/feed/51892/rss.xml', region: 'AU' },
    { name: 'Business News AU', url: 'https://www.businessnews.com.au/rssfeed/latest.rss', region: 'AU' },
  ],

  // ── Tech ────────────────────────────────────────────────
  tech: [
    { name: 'iTnews', url: 'https://www.itnews.com.au/rss/feed.aspx', region: 'AU' },
    { name: 'ZDNet AU', url: 'https://www.zdnet.com/au/rss.xml', region: 'AU' },
    { name: 'Startup Daily', url: 'https://www.startupdaily.net/feed/', region: 'AU' },
  ],

  // ── Politics / Government ───────────────────────────────
  politics: [
    { name: 'ABC Politics', url: 'https://www.abc.net.au/news/feed/51120/rss.xml', region: 'AU' },
    { name: 'The Mandarin', url: 'https://www.themandarin.com.au/feed/', region: 'AU' },
  ],
};

/** Flatten all AU feeds into a single list */
export function getAllAUFeeds(): Feed[] {
  return Object.values(AU_NEWS_FEEDS).flat();
}

/** Get feeds for a specific category */
export function getAUFeedsByCategory(category: string): Feed[] {
  return AU_NEWS_FEEDS[category] || [];
}

/** AU-specific source tiers */
export const AU_SOURCE_TIERS: Record<string, number> = {
  'ABC News': 1,
  'ABC News Top Stories': 1,
  'SBS News': 1,
  'The Guardian AU': 2,
  'Sydney Morning Herald': 2,
  'The Age': 2,
  'AFR': 2,
  'The Australian': 2,
  'News.com.au': 2,
  'Sky News AU': 2,
  'Daily Telegraph': 3,
  'Herald Sun': 3,
  'Courier Mail': 3,
  'Crikey': 3,
  'The Conversation AU': 3,
  'ABC Emergency': 1,
  'BOM Warnings': 1,
  'iTnews': 3,
  'WAtoday': 3,
  'The Advertiser': 3,
};

// This module doesn't need to be an adapter class —
// it plugs into the existing feed system via config.
// The AUNewsAdapter is a thin wrapper for the registry.
export class AUNewsAdapter {
  id = 'au-news' as const;
  name = 'Australian News';
  feeds = getAllAUFeeds();
  tiers = AU_SOURCE_TIERS;
}
