// src/config/sentinel-feeds.ts
// New RSS feeds added by Sentinel. Imported into feeds.ts.
// These feeds are CONFIRMED to NOT exist in the upstream feeds.ts.

import type { Feed } from '@/types';
import type { SourceRiskProfile, SourceType } from './feeds';

// Helper to create RSS proxy URL (mirrors the one in feeds.ts)
const rss = (url: string) => `/api/rss-proxy?url=${encodeURIComponent(url)}`;

/**
 * Source tier entries for Sentinel-specific feeds.
 * Spread into SOURCE_TIERS in feeds.ts.
 */
export const SENTINEL_SOURCE_TIERS: Record<string, number> = {
  'ISW': 3,
  'INSS': 3,
  'IISS': 3,
  'Al-Monitor': 3,
  'Middle East Eye': 3,
  'Stars and Stripes': 3,
};

/**
 * Source type entries for Sentinel-specific feeds.
 * Spread into SOURCE_TYPES in feeds.ts.
 */
export const SENTINEL_SOURCE_TYPES: Record<string, SourceType> = {
  'ISW': 'intel',
  'INSS': 'intel',
  'IISS': 'intel',
  'Al-Monitor': 'mainstream',
  'Middle East Eye': 'mainstream',
  'Stars and Stripes': 'intel',
};

/**
 * Propaganda risk profiles for Sentinel-specific feeds.
 * Spread into SOURCE_PROPAGANDA_RISK in feeds.ts.
 */
export const SENTINEL_SOURCE_PROPAGANDA_RISK: Record<string, SourceRiskProfile> = {
  'Al-Monitor': { risk: 'low', note: 'Independent Middle East news, US-based' },
  'Middle East Eye': { risk: 'medium', knownBiases: ['Pro-Palestinian'], note: 'UK-based, Qatari-linked funding' },
  'Stars and Stripes': { risk: 'low', note: 'Editorially independent US military newspaper, congressionally funded' },
  'ISW': { risk: 'low', note: 'Independent US think tank focused on military affairs' },
  'INSS': { risk: 'medium', stateAffiliated: 'Israel', note: 'Israeli national security think tank, Tel Aviv University' },
  'IISS': { risk: 'low', note: 'Independent UK-based strategic studies institute' },
};

/**
 * Sentinel-specific feeds for the thinktanks/intel category.
 * All use Google News RSS as proxy (matching existing codebase pattern).
 */
export const SENTINEL_FEEDS: Feed[] = [
  // Defense & Security Think Tanks
  { name: 'ISW', url: rss('https://news.google.com/rss/search?q=site:understandingwar.org+when:3d&hl=en-US&gl=US&ceid=US:en'), type: 'defense' },
  { name: 'INSS', url: rss('https://news.google.com/rss/search?q=site:inss.org.il+when:7d&hl=en-US&gl=US&ceid=US:en'), type: 'research' },
  { name: 'IISS', url: rss('https://news.google.com/rss/search?q=site:iiss.org+when:7d&hl=en-US&gl=US&ceid=US:en'), type: 'research' },

  // Regional News
  { name: 'Al-Monitor', url: rss('https://news.google.com/rss/search?q=site:al-monitor.com+when:3d&hl=en-US&gl=US&ceid=US:en'), type: 'intl' },
  { name: 'Middle East Eye', url: rss('https://news.google.com/rss/search?q=site:middleeasteye.net+when:3d&hl=en-US&gl=US&ceid=US:en'), type: 'intl' },

  // Military News
  { name: 'Stars and Stripes', url: rss('https://news.google.com/rss/search?q=site:stripes.com+when:3d&hl=en-US&gl=US&ceid=US:en'), type: 'defense' },
];
