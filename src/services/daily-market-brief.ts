import type { MarketData, NewsItem } from '@/types';
import type { MarketWatchlistEntry } from './market-watchlist';
import { getMarketWatchlistEntries } from './market-watchlist';
import type { translateContentText } from './content-translation';
import type { SummarizationResult } from './summarization';

export interface DailyMarketBriefItem {
  symbol: string;
  name: string;
  display: string;
  price: number | null;
  change: number | null;
  stance: 'bullish' | 'neutral' | 'defensive';
  note: string;
  relatedHeadline?: string;
}

export interface DailyMarketBrief {
  available: boolean;
  title: string;
  dateKey: string;
  timezone: string;
  lang?: string;
  summary: string;
  actionPlan: string;
  riskWatch: string;
  items: DailyMarketBriefItem[];
  provider: string;
  model: string;
  fallback: boolean;
  generatedAt: string;
  headlineCount: number;
}

export interface BuildDailyMarketBriefOptions {
  markets: MarketData[];
  newsByCategory: Record<string, NewsItem[]>;
  lang?: string;
  timezone?: string;
  now?: Date;
  targets?: MarketWatchlistEntry[];
  summarize?: (
    headlines: string[],
    onProgress?: undefined,
    geoContext?: string,
    lang?: string,
  ) => Promise<SummarizationResult | null>;
  translate?: typeof translateContentText;
}

async function getDefaultSummarizer(): Promise<NonNullable<BuildDailyMarketBriefOptions['summarize']>> {
  const { generateSummary } = await import('./summarization');
  return generateSummary;
}

async function getDefaultTranslator(): Promise<NonNullable<BuildDailyMarketBriefOptions['translate']>> {
  const { translateContentText } = await import('./content-translation');
  return translateContentText;
}

async function getPersistentCacheApi(): Promise<{
  getPersistentCache: <T>(key: string) => Promise<{ data: T } | null>;
  setPersistentCache: <T>(key: string, data: T) => Promise<void>;
}> {
  const { getPersistentCache, setPersistentCache } = await import('./persistent-cache');
  return { getPersistentCache, setPersistentCache };
}

const CACHE_PREFIX = 'premium:daily-market-brief:v1';
const DEFAULT_SCHEDULE_HOUR = 8;
const DEFAULT_TARGET_COUNT = 4;
const BRIEF_NEWS_CATEGORIES = ['markets', 'economic', 'crypto', 'finance'];
const COMMON_NAME_TOKENS = new Set(['inc', 'corp', 'group', 'holdings', 'company', 'companies', 'class', 'common', 'plc', 'limited', 'ltd', 'adr']);

function normalizeLanguage(language?: string): string {
  return String(language || 'en').trim().toLowerCase().split('-')[0] || 'en';
}

function resolveTimeZone(timezone?: string): string {
  const candidate = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  try {
    Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return 'UTC';
  }
}

function getLocalDateParts(date: Date, timezone: string): { year: string; month: string; day: string; hour: string } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: resolveTimeZone(timezone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const read = (type: string): string => parts.find((part) => part.type === type)?.value || '';
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
  };
}

function getDateKey(date: Date, timezone: string): string {
  const parts = getLocalDateParts(date, timezone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getLocalHour(date: Date, timezone: string): number {
  return Number.parseInt(getLocalDateParts(date, timezone).hour || '0', 10) || 0;
}

function formatTitleDate(date: Date, timezone: string, lang = 'en'): string {
  const locale = normalizeLanguage(lang) === 'en' ? 'en-US' : normalizeLanguage(lang);
  return new Intl.DateTimeFormat(locale, {
    timeZone: resolveTimeZone(timezone),
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function sanitizeCacheKeyPart(value: string): string {
  return value.replace(/[^a-z0-9/_-]+/gi, '-').toLowerCase();
}

function getCacheKey(timezone: string, lang = 'en'): string {
  return `${CACHE_PREFIX}:${sanitizeCacheKeyPart(resolveTimeZone(timezone))}:${sanitizeCacheKeyPart(normalizeLanguage(lang))}`;
}

async function translateBriefCopy(
  text: string,
  targetLang: string,
  translate: NonNullable<BuildDailyMarketBriefOptions['translate']>,
): Promise<string> {
  if (!text) return text;
  const normalizedLang = normalizeLanguage(targetLang);
  if (normalizedLang === 'en') return text;
  const translated = await translate(text, normalizedLang, { sourceLang: 'en' });
  return translated || text;
}

function isMeaningfulToken(token: string): boolean {
  return token.length >= 3 && !COMMON_NAME_TOKENS.has(token);
}

function getSymbolTokens(item: Pick<MarketData, 'symbol' | 'display' | 'name'>): string[] {
  const raw = [
    item.symbol,
    item.display,
    ...item.name.toLowerCase().split(/[^a-z0-9]+/gi),
  ];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const token of raw) {
    const normalized = token.trim().toLowerCase();
    if (!isMeaningfulToken(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function matchesMarketHeadline(market: Pick<MarketData, 'symbol' | 'display' | 'name'>, title: string): boolean {
  const normalizedTitle = title.toLowerCase();
  return getSymbolTokens(market).some((token) => {
    if (token.length <= 4) {
      return new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(normalizedTitle);
    }
    return normalizedTitle.includes(token);
  });
}

function collectHeadlinePool(newsByCategory: Record<string, NewsItem[]>): NewsItem[] {
  return BRIEF_NEWS_CATEGORIES
    .flatMap((category) => newsByCategory[category] || [])
    .filter((item) => !!item?.title)
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
}

function resolveTargets(markets: MarketData[], explicitTargets?: MarketWatchlistEntry[]): MarketData[] {
  const explicitEntries = explicitTargets?.length ? explicitTargets : null;
  const watchlistEntries = explicitEntries ? null : getMarketWatchlistEntries();
  const targetEntries = explicitEntries || (watchlistEntries && watchlistEntries.length > 0 ? watchlistEntries : []);

  const bySymbol = new Map(markets.map((market) => [market.symbol, market]));
  const resolved: MarketData[] = [];
  const seen = new Set<string>();

  for (const entry of targetEntries) {
    const match = bySymbol.get(entry.symbol);
    if (!match || seen.has(match.symbol)) continue;
    seen.add(match.symbol);
    resolved.push(match);
    if (resolved.length >= DEFAULT_TARGET_COUNT) return resolved;
  }

  if (!explicitEntries && !(watchlistEntries && watchlistEntries.length > 0)) {
    for (const market of markets) {
      if (seen.has(market.symbol)) continue;
      seen.add(market.symbol);
      resolved.push(market);
      if (resolved.length >= DEFAULT_TARGET_COUNT) break;
    }
  }

  return resolved;
}

function getStance(change: number | null): DailyMarketBriefItem['stance'] {
  if (typeof change !== 'number') return 'neutral';
  if (change >= 1) return 'bullish';
  if (change <= -1) return 'defensive';
  return 'neutral';
}

function formatSignedPercent(value: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'flat';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function buildItemNote(change: number | null, relatedHeadline?: string): string {
  const stance = getStance(change);
  const moveNote = stance === 'bullish'
    ? 'Momentum is constructive; favor leaders over laggards.'
    : stance === 'defensive'
      ? 'Price action is under pressure; protect capital first.'
      : 'Tape is balanced; wait for confirmation before pressing size.';
  return relatedHeadline
    ? `${moveNote} Headline driver: ${relatedHeadline}`
    : moveNote;
}

function buildRuleSummary(items: DailyMarketBriefItem[], headlineCount: number): string {
  const bullish = items.filter((item) => item.stance === 'bullish').length;
  const defensive = items.filter((item) => item.stance === 'defensive').length;
  const neutral = items.length - bullish - defensive;

  const bias = bullish > defensive
    ? 'Risk appetite is leaning positive across the tracked watchlist.'
    : defensive > bullish
      ? 'The watchlist is trading defensively and breadth is soft.'
      : 'The watchlist is mixed and conviction is limited.';

  const breadth = `Leaders: ${bullish}, neutral setups: ${neutral}, defensive names: ${defensive}.`;
  const headlines = headlineCount > 0
    ? `News flow remains active with ${headlineCount} relevant headline${headlineCount === 1 ? '' : 's'} in scope.`
    : 'Headline flow is thin, so price action matters more than narrative today.';

  return `${bias} ${breadth} ${headlines}`;
}

function buildActionPlan(items: DailyMarketBriefItem[], headlineCount: number): string {
  const bullish = items.filter((item) => item.stance === 'bullish').length;
  const defensive = items.filter((item) => item.stance === 'defensive').length;

  if (defensive > bullish) {
    return headlineCount > 0
      ? 'Keep gross exposure light, wait for downside to stabilize, and let macro headlines clear before adding risk.'
      : 'Keep exposure light and wait for price to reclaim short-term momentum before adding risk.';
  }

  if (bullish >= 2) {
    return headlineCount > 0
      ? 'Lean into relative strength, but size entries around macro releases and company-specific headlines.'
      : 'Lean into the strongest names on pullbacks and avoid chasing extended opening moves.';
  }

  return 'Stay selective, trade the cleanest relative-strength setups, and let index direction confirm before scaling.';
}

function buildRiskWatch(items: DailyMarketBriefItem[], headlines: NewsItem[]): string {
  const defensive = items.filter((item) => item.stance === 'defensive').map((item) => item.display);
  const headlineTitles = headlines.slice(0, 2).map((item) => item.title);

  if (defensive.length > 0 && headlineTitles.length > 0) {
    return `Watch ${defensive.join(', ')} for further weakness while monitoring: ${headlineTitles.join(' | ')}`;
  }
  if (defensive.length > 0) {
    return `Watch ${defensive.join(', ')} for further weakness and avoid averaging into fading momentum.`;
  }
  if (headlineTitles.length > 0) {
    return `Headline watch: ${headlineTitles.join(' | ')}`;
  }
  return 'Risk watch is centered on macro follow-through, index breadth, and any abrupt reversal in the strongest names.';
}

function buildSummaryInputs(items: DailyMarketBriefItem[], headlines: NewsItem[]): { headlines: string[]; marketContext: string } {
  const marketContext = items.map((item) => {
    const change = formatSignedPercent(item.change);
    return `${item.name} (${item.display}) ${change}`;
  }).join(', ');

  const headlineLines = headlines.slice(0, 6).map((item) => item.title.trim()).filter(Boolean);
  return { headlines: headlineLines, marketContext };
}

export function shouldRefreshDailyBrief(
  brief: DailyMarketBrief | null | undefined,
  timezone = 'UTC',
  now = new Date(),
  scheduleHour = DEFAULT_SCHEDULE_HOUR,
): boolean {
  if (!brief?.available) return true;
  const resolvedTimezone = resolveTimeZone(timezone || brief.timezone);
  const dateKey = getDateKey(now, resolvedTimezone);
  if (brief.dateKey === dateKey) return false;
  return getLocalHour(now, resolvedTimezone) >= scheduleHour;
}

export async function getCachedDailyMarketBrief(timezone?: string, lang = 'en'): Promise<DailyMarketBrief | null> {
  const resolvedTimezone = resolveTimeZone(timezone);
  const { getPersistentCache } = await getPersistentCacheApi();
  const envelope = await getPersistentCache<DailyMarketBrief>(getCacheKey(resolvedTimezone, lang));
  return envelope?.data ?? null;
}

export async function cacheDailyMarketBrief(brief: DailyMarketBrief): Promise<void> {
  const { setPersistentCache } = await getPersistentCacheApi();
  await setPersistentCache(getCacheKey(brief.timezone, brief.lang), brief);
}

export async function buildDailyMarketBrief(options: BuildDailyMarketBriefOptions): Promise<DailyMarketBrief> {
  const now = options.now || new Date();
  const timezone = resolveTimeZone(options.timezone);
  const lang = normalizeLanguage(options.lang);
  const trackedMarkets = resolveTargets(options.markets, options.targets).slice(0, DEFAULT_TARGET_COUNT);
  const relevantHeadlines = collectHeadlinePool(options.newsByCategory);

  let items: DailyMarketBriefItem[] = trackedMarkets.map((market) => {
    const relatedHeadline = relevantHeadlines.find((headline) => matchesMarketHeadline(market, headline.title))?.title;
    return {
      symbol: market.symbol,
      name: market.name,
      display: market.display,
      price: market.price,
      change: market.change,
      stance: getStance(market.change),
      note: buildItemNote(market.change, relatedHeadline),
      ...(relatedHeadline ? { relatedHeadline } : {}),
    };
  });

  if (items.length === 0) {
    const translate = options.translate || await getDefaultTranslator();
    const titlePrefix = await translateBriefCopy('Daily Market Brief', lang, translate);
    const unavailableSummary = await translateBriefCopy('Market data is not available yet for the daily brief.', lang, translate);
    return {
      available: false,
      title: `${titlePrefix} • ${formatTitleDate(now, timezone, lang)}`,
      dateKey: getDateKey(now, timezone),
      timezone,
      lang,
      summary: unavailableSummary,
      actionPlan: '',
      riskWatch: '',
      items: [],
      provider: 'rules',
      model: '',
      fallback: true,
      generatedAt: now.toISOString(),
      headlineCount: 0,
    };
  }

  const { headlines: summaryHeadlines, marketContext } = buildSummaryInputs(items, relevantHeadlines);
  let summary = buildRuleSummary(items, relevantHeadlines.length);
  let titlePrefix = 'Daily Market Brief';
  let actionPlan = buildActionPlan(items, relevantHeadlines.length);
  let riskWatch = buildRiskWatch(items, relevantHeadlines);
  let provider = 'rules';
  let model = '';
  let fallback = true;

  if (summaryHeadlines.length >= 1) {
    try {
      const summaryProvider = options.summarize || await getDefaultSummarizer();
      const generated = await summaryProvider(
        summaryHeadlines,
        undefined,
        `Market context: ${marketContext}`,
        lang,
      );
      if (generated?.summary) {
        summary = generated.summary.trim();
        provider = generated.provider;
        model = generated.model;
        fallback = false;
      }
    } catch (err) {
      console.warn('[DailyBrief] AI summarization failed, using rules-based fallback:', (err as Error).message);
    }
  }

  if (lang !== 'en') {
    const translate = options.translate || await getDefaultTranslator();
    const [localizedTitlePrefix, localizedSummary, localizedActionPlan, localizedRiskWatch, localizedNotes] = await Promise.all([
      translateBriefCopy(titlePrefix, lang, translate),
      fallback ? translateBriefCopy(summary, lang, translate) : Promise.resolve(summary),
      translateBriefCopy(actionPlan, lang, translate),
      translateBriefCopy(riskWatch, lang, translate),
      Promise.all(items.map((item) => translateBriefCopy(item.note, lang, translate))),
    ]);

    titlePrefix = localizedTitlePrefix;
    summary = localizedSummary;
    actionPlan = localizedActionPlan;
    riskWatch = localizedRiskWatch;
    items = items.map((item, index) => ({ ...item, note: localizedNotes[index] || item.note }));
  }

  return {
    available: true,
    title: `${titlePrefix} • ${formatTitleDate(now, timezone, lang)}`,
    dateKey: getDateKey(now, timezone),
    timezone,
    lang,
    summary,
    actionPlan,
    riskWatch,
    items,
    provider,
    model,
    fallback,
    generatedAt: now.toISOString(),
    headlineCount: relevantHeadlines.length,
  };
}
