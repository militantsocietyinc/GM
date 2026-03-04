/**
 * Tool Registry — maps Claude tool definitions to internal RPC handlers.
 *
 * Each entry defines:
 *   - name: snake_case tool identifier used by Claude
 *   - description: Chinese-language description of the tool
 *   - input_schema: JSON Schema for the tool parameters
 *   - execute: async fn that dynamically imports the handler and calls it
 *
 * SENTINEL: This file is part of the Intelligence Assistant module.
 */

// ========================================================================
// Types
// ========================================================================

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface ToolRegistryEntry extends ToolDefinition {
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

// ========================================================================
// Registry
// ========================================================================

const registry: ToolRegistryEntry[] = [];

function register(
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[] | undefined,
  execute: (args: Record<string, unknown>) => Promise<unknown>,
): void {
  registry.push({
    name,
    description,
    input_schema: { type: 'object', properties, required },
    execute,
  });
}

/** Stub ServerContext for calling handlers outside of a real HTTP request. */
function stubCtx() {
  return { request: new Request('http://localhost'), pathParams: {}, headers: {} } as any;
}

// ========================================================================
// Conflict
// ========================================================================

register(
  'list_acled_events',
  '查询ACLED武装冲突数据（战斗、爆炸、平民暴力事件），支持国家和时间范围筛选',
  {
    country: { type: 'string', description: 'ISO-2 country code, e.g. "UA"' },
    start: { type: 'number', description: 'Start timestamp (ms)' },
    end: { type: 'number', description: 'End timestamp (ms)' },
  },
  undefined,
  async (args) => {
    const { listAcledEvents } = await import('../../conflict/v1/list-acled-events.ts');
    return listAcledEvents(stubCtx(), { country: args.country as string ?? '', start: args.start as number ?? 0, end: args.end as number ?? 0 });
  },
);

register(
  'list_iran_events',
  '查询伊朗相关冲突事件（从Redis缓存中获取已抓取的数据）',
  {},
  undefined,
  async () => {
    const { listIranEvents } = await import('../../conflict/v1/list-iran-events.ts');
    return listIranEvents(stubCtx(), {});
  },
);

register(
  'list_ucdp_events',
  '查询UCDP（乌普萨拉冲突数据）暴力事件，支持按国家筛选',
  {
    country: { type: 'string', description: 'Country name filter' },
  },
  undefined,
  async (args) => {
    const { listUcdpEvents } = await import('../../conflict/v1/list-ucdp-events.ts');
    return listUcdpEvents(stubCtx(), { country: args.country as string ?? '' });
  },
);

register(
  'get_humanitarian_summary',
  '获取指定国家的人道主义冲突事件汇总（来源：HAPI/HDX API）',
  {
    countryCode: { type: 'string', description: 'ISO-2 country code, e.g. "UA"' },
  },
  ['countryCode'],
  async (args) => {
    const { getHumanitarianSummary } = await import('../../conflict/v1/get-humanitarian-summary.ts');
    return getHumanitarianSummary(stubCtx(), { countryCode: args.countryCode as string });
  },
);

// ========================================================================
// Military
// ========================================================================

register(
  'list_military_flights',
  '查询实时军事航班追踪数据（OpenSky/Wingbits），支持地理范围筛选',
  {
    swLat: { type: 'number', description: 'Southwest latitude' },
    swLon: { type: 'number', description: 'Southwest longitude' },
    neLat: { type: 'number', description: 'Northeast latitude' },
    neLon: { type: 'number', description: 'Northeast longitude' },
  },
  undefined,
  async (args) => {
    const { listMilitaryFlights } = await import('../../military/v1/list-military-flights.ts');
    return listMilitaryFlights(stubCtx(), {
      swLat: args.swLat as number ?? 0, swLon: args.swLon as number ?? 0,
      neLat: args.neLat as number ?? 0, neLon: args.neLon as number ?? 0,
    } as any);
  },
);

register(
  'list_military_bases',
  '查询全球军事基地数据（支持类型、国家、地理范围筛选和聚合）',
  {
    swLat: { type: 'number', description: 'Southwest latitude' },
    swLon: { type: 'number', description: 'Southwest longitude' },
    neLat: { type: 'number', description: 'Northeast latitude' },
    neLon: { type: 'number', description: 'Northeast longitude' },
    type: { type: 'string', description: 'Base type filter: us-nato, china, russia, etc.' },
    country: { type: 'string', description: 'ISO-2 country code' },
  },
  undefined,
  async (args) => {
    const { listMilitaryBases } = await import('../../military/v1/list-military-bases.ts');
    return listMilitaryBases(stubCtx(), args as any);
  },
);

register(
  'get_theater_posture',
  '获取各战区军事态势概览（活跃军机数量、类型分布等）',
  {},
  undefined,
  async () => {
    const { getTheaterPosture } = await import('../../military/v1/get-theater-posture.ts');
    return getTheaterPosture(stubCtx(), {} as any);
  },
);

register(
  'get_usni_fleet_report',
  '获取USNI海军舰队部署报告（舰艇位置、打击群组成等）',
  {
    forceRefresh: { type: 'boolean', description: 'Force cache refresh' },
  },
  undefined,
  async (args) => {
    const { getUSNIFleetReport } = await import('../../military/v1/get-usni-fleet-report.ts');
    return getUSNIFleetReport(stubCtx(), { forceRefresh: args.forceRefresh as boolean ?? false } as any);
  },
);

register(
  'get_aircraft_details',
  '查询军用飞机详细信息（按ICAO24地址），包括机型、所属单位等',
  {
    icao24: { type: 'string', description: 'ICAO 24-bit hex address, e.g. "ae1234"' },
  },
  ['icao24'],
  async (args) => {
    const { getAircraftDetails } = await import('../../military/v1/get-aircraft-details.ts');
    return getAircraftDetails(stubCtx(), { icao24: args.icao24 as string });
  },
);

// ========================================================================
// Intelligence
// ========================================================================

register(
  'search_gdelt_documents',
  '搜索GDELT全球新闻文档数据库，支持关键词、情感色调筛选',
  {
    query: { type: 'string', description: 'Search query (min 2 characters)' },
    toneFilter: { type: 'string', description: 'Tone filter, e.g. "tone>5" for positive' },
    maxRecords: { type: 'number', description: 'Max results (default 10, max 20)' },
  },
  ['query'],
  async (args) => {
    const { searchGdeltDocuments } = await import('../../intelligence/v1/search-gdelt-documents.ts');
    return searchGdeltDocuments(stubCtx(), {
      query: args.query as string,
      toneFilter: args.toneFilter as string ?? '',
      maxRecords: args.maxRecords as number ?? 10,
    } as any);
  },
);

register(
  'get_risk_scores',
  '获取全球主要国家的综合风险评分（基于ACLED冲突数据和GDELT新闻情绪）',
  {},
  undefined,
  async () => {
    const { getRiskScores } = await import('../../intelligence/v1/get-risk-scores.ts');
    return getRiskScores(stubCtx(), {} as any);
  },
);

register(
  'get_country_intel_brief',
  '获取指定国家的AI生成情报简报（使用Groq/LLM自动综合多源信息）',
  {
    countryCode: { type: 'string', description: 'ISO-2 country code, e.g. "UA"' },
  },
  ['countryCode'],
  async (args) => {
    const { getCountryIntelBrief } = await import('../../intelligence/v1/get-country-intel-brief.ts');
    return getCountryIntelBrief(stubCtx(), { countryCode: args.countryCode as string });
  },
);

// ========================================================================
// Social Media
// ========================================================================

register(
  'list_reddit_posts',
  '获取Reddit子版块帖子（默认OSINT/geopolitics/worldnews相关版块）',
  {
    subreddits: { type: 'array', items: { type: 'string' }, description: 'Subreddit names' },
    limit: { type: 'number', description: 'Max posts to return' },
  },
  undefined,
  async (args) => {
    const { listRedditPosts } = await import('../../social/v1/reddit.ts');
    return listRedditPosts(stubCtx(), { subreddits: args.subreddits as string[] ?? [], limit: args.limit as number ?? 25 } as any);
  },
);

register(
  'list_tweets',
  '搜索Twitter/X帖子（支持关键词搜索和用户时间线查询）',
  {
    query: { type: 'string', description: 'Search query' },
    username: { type: 'string', description: 'Twitter username (without @)' },
    limit: { type: 'number', description: 'Max tweets to return' },
  },
  undefined,
  async (args) => {
    const { listTweets } = await import('../../social/v1/twitter.ts');
    return listTweets(stubCtx(), { query: args.query as string ?? '', username: args.username as string ?? '', limit: args.limit as number ?? 25 } as any);
  },
);

register(
  'list_bluesky_posts',
  '搜索Bluesky帖子（使用AT Protocol公共API，无需认证）',
  {
    query: { type: 'string', description: 'Search query' },
    limit: { type: 'number', description: 'Max posts (max 25)' },
  },
  undefined,
  async (args) => {
    const { listBlueskyPosts } = await import('../../social/v1/bluesky.ts');
    return listBlueskyPosts(stubCtx(), { query: args.query as string ?? '', limit: args.limit as number ?? 25 } as any);
  },
);

register(
  'list_youtube_videos',
  '搜索YouTube视频（使用YouTube Data API v3）',
  {
    query: { type: 'string', description: 'Search query' },
    channelId: { type: 'string', description: 'YouTube channel ID' },
    limit: { type: 'number', description: 'Max results (max 50)' },
  },
  undefined,
  async (args) => {
    const { listYouTubeVideos } = await import('../../social/v1/youtube.ts');
    return listYouTubeVideos(stubCtx(), { query: args.query as string ?? '', channelId: args.channelId as string ?? '', limit: args.limit as number ?? 10 } as any);
  },
);

register(
  'list_tiktok_posts',
  '搜索TikTok帖子（通过Apify TikTok Scraper获取）',
  {
    query: { type: 'string', description: 'Search query' },
    limit: { type: 'number', description: 'Max posts (max 50)' },
  },
  undefined,
  async (args) => {
    const { listTikTokPosts } = await import('../../social/v1/tiktok.ts');
    return listTikTokPosts(stubCtx(), { query: args.query as string ?? '', limit: args.limit as number ?? 20 } as any);
  },
);

register(
  'list_vk_posts',
  '获取VK（俄罗斯社交网络）公共群组帖子，默认关注RIA/RT/军事媒体',
  {
    ownerIds: { type: 'array', items: { type: 'string' }, description: 'VK group owner IDs (negative for groups)' },
    count: { type: 'number', description: 'Posts per group' },
  },
  undefined,
  async (args) => {
    const { listVKPosts } = await import('../../social/v1/vk.ts');
    return listVKPosts(stubCtx(), { ownerIds: args.ownerIds as string[] ?? [], count: args.count as number ?? 10 } as any);
  },
);

// ========================================================================
// News
// ========================================================================

register(
  'list_feed_digest',
  '获取RSS新闻摘要（支持full/tech/finance/happy变体，带威胁分级分类）',
  {
    variant: { type: 'string', enum: ['full', 'tech', 'finance', 'happy'], description: 'Feed variant' },
    lang: { type: 'string', description: 'Language code, e.g. "en", "zh"' },
  },
  undefined,
  async (args) => {
    const { listFeedDigest } = await import('../../news/v1/list-feed-digest.ts');
    return listFeedDigest(stubCtx(), { variant: args.variant as string ?? 'full', lang: args.lang as string ?? 'en' } as any);
  },
);

register(
  'summarize_article',
  '使用LLM对新闻标题进行智能摘要（支持多种AI提供商）',
  {
    provider: { type: 'string', description: 'AI provider name' },
    mode: { type: 'string', enum: ['brief', 'detailed'], description: 'Summary mode' },
    variant: { type: 'string', description: 'Feed variant' },
    lang: { type: 'string', description: 'Language code' },
    geoContext: { type: 'string', description: 'Geographic context' },
  },
  undefined,
  async (args) => {
    const { summarizeArticle } = await import('../../news/v1/summarize-article.ts');
    return summarizeArticle(stubCtx(), {
      provider: args.provider as string ?? '',
      mode: args.mode as string ?? 'brief',
      variant: args.variant as string ?? 'full',
      lang: args.lang as string ?? 'en',
      geoContext: args.geoContext as string ?? '',
    } as any);
  },
);

// ========================================================================
// Market
// ========================================================================

register(
  'list_market_quotes',
  '获取股票/指数行情报价（数据源：Finnhub + Yahoo Finance）',
  {
    symbols: { type: 'array', items: { type: 'string' }, description: 'Stock/index symbols, e.g. ["^GSPC", "AAPL"]' },
  },
  undefined,
  async (args) => {
    const { listMarketQuotes } = await import('../../market/v1/list-market-quotes.ts');
    return listMarketQuotes(stubCtx(), { symbols: args.symbols as string[] ?? [] } as any);
  },
);

register(
  'list_crypto_quotes',
  '获取加密货币行情报价（数据源：CoinGecko）',
  {
    ids: { type: 'array', items: { type: 'string' }, description: 'CoinGecko IDs, e.g. ["bitcoin", "ethereum"]' },
  },
  undefined,
  async (args) => {
    const { listCryptoQuotes } = await import('../../market/v1/list-crypto-quotes.ts');
    return listCryptoQuotes(stubCtx(), { ids: args.ids as string[] ?? [] } as any);
  },
);

register(
  'list_commodity_quotes',
  '获取大宗商品期货报价（数据源：Yahoo Finance）',
  {
    symbols: { type: 'array', items: { type: 'string' }, description: 'Commodity symbols, e.g. ["GC=F", "CL=F"]' },
  },
  ['symbols'],
  async (args) => {
    const { listCommodityQuotes } = await import('../../market/v1/list-commodity-quotes.ts');
    return listCommodityQuotes(stubCtx(), { symbols: args.symbols as string[] } as any);
  },
);

register(
  'list_etf_flows',
  '获取BTC现货ETF资金流向估算（基于Yahoo Finance成交量/价格数据）',
  {},
  undefined,
  async () => {
    const { listEtfFlows } = await import('../../market/v1/list-etf-flows.ts');
    return listEtfFlows(stubCtx(), {} as any);
  },
);

register(
  'list_gulf_quotes',
  '获取海湾国家股指、货币和石油基准报价',
  {},
  undefined,
  async () => {
    const { listGulfQuotes } = await import('../../market/v1/list-gulf-quotes.ts');
    return listGulfQuotes(stubCtx(), {} as any);
  },
);

register(
  'get_sector_summary',
  '获取美国股市板块ETF表现概览（XLK、XLF、XLE等）',
  {},
  undefined,
  async () => {
    const { getSectorSummary } = await import('../../market/v1/get-sector-summary.ts');
    return getSectorSummary(stubCtx(), {} as any);
  },
);

register(
  'list_stablecoin_markets',
  '获取稳定币锚定健康状态数据（USDT、USDC、DAI等）',
  {
    ids: { type: 'string', description: 'Comma-separated CoinGecko IDs' },
  },
  undefined,
  async (args) => {
    const { listStablecoinMarkets } = await import('../../market/v1/list-stablecoin-markets.ts');
    return listStablecoinMarkets(stubCtx(), { ids: args.ids as string ?? '' } as any);
  },
);

register(
  'get_country_stock_index',
  '获取指定国家的主要股市指数行情（支持40+国家）',
  {
    countryCode: { type: 'string', description: 'ISO-2 country code, e.g. "US", "CN", "JP"' },
  },
  ['countryCode'],
  async (args) => {
    const { getCountryStockIndex } = await import('../../market/v1/get-country-stock-index.ts');
    return getCountryStockIndex(stubCtx(), { countryCode: args.countryCode as string } as any);
  },
);

// ========================================================================
// Economic
// ========================================================================

register(
  'get_macro_signals',
  '获取7维度宏观经济信号仪表盘（流动性、恐惧贪婪指数等）',
  {},
  undefined,
  async () => {
    const { getMacroSignals } = await import('../../economic/v1/get-macro-signals.ts');
    return getMacroSignals(stubCtx(), {} as any);
  },
);

register(
  'get_energy_prices',
  '获取能源商品价格数据（WTI、Brent等，数据源：EIA Open Data API）',
  {
    commodities: { type: 'array', items: { type: 'string' }, description: 'Commodity codes, e.g. ["wti", "brent"]' },
  },
  undefined,
  async (args) => {
    const { getEnergyPrices } = await import('../../economic/v1/get-energy-prices.ts');
    return getEnergyPrices(stubCtx(), { commodities: args.commodities as string[] ?? [] } as any);
  },
);

register(
  'get_bis_policy_rates',
  '获取BIS各国央行政策利率数据（主要经济体的利率水平和变化趋势）',
  {},
  undefined,
  async () => {
    const { getBisPolicyRates } = await import('../../economic/v1/get-bis-policy-rates.ts');
    return getBisPolicyRates(stubCtx(), {} as any);
  },
);

register(
  'get_bis_exchange_rates',
  '获取BIS实际有效汇率指数（衡量各国货币竞争力变化）',
  {},
  undefined,
  async () => {
    const { getBisExchangeRates } = await import('../../economic/v1/get-bis-exchange-rates.ts');
    return getBisExchangeRates(stubCtx(), {} as any);
  },
);

register(
  'get_fred_series',
  '查询FRED美联储经济数据时间序列（支持任意series ID）',
  {
    seriesId: { type: 'string', description: 'FRED series ID, e.g. "DGS10", "UNRATE"' },
    limit: { type: 'number', description: 'Number of observations (default 120, max 1000)' },
  },
  ['seriesId'],
  async (args) => {
    const { getFredSeries } = await import('../../economic/v1/get-fred-series.ts');
    return getFredSeries(stubCtx(), { seriesId: args.seriesId as string, limit: args.limit as number ?? 120 } as any);
  },
);

register(
  'list_world_bank_indicators',
  '查询世界银行发展指标数据（GDP、人口、研发支出等）',
  {
    indicatorCode: { type: 'string', description: 'World Bank indicator code, e.g. "NY.GDP.MKTP.CD"' },
    countryCode: { type: 'string', description: 'ISO-3 country codes (semicolon-separated)' },
    year: { type: 'number', description: 'Number of years to fetch (default 5)' },
  },
  ['indicatorCode'],
  async (args) => {
    const { listWorldBankIndicators } = await import('../../economic/v1/list-world-bank-indicators.ts');
    return listWorldBankIndicators(stubCtx(), {
      indicatorCode: args.indicatorCode as string,
      countryCode: args.countryCode as string ?? '',
      year: args.year as number ?? 5,
    } as any);
  },
);

register(
  'get_energy_capacity',
  '获取美国发电装机容量数据（太阳能、风能、煤炭的历年变化）',
  {
    years: { type: 'number', description: 'Number of years to fetch (default 20)' },
  },
  undefined,
  async (args) => {
    const { getEnergyCapacity } = await import('../../economic/v1/get-energy-capacity.ts');
    return getEnergyCapacity(stubCtx(), { years: args.years as number ?? 20 } as any);
  },
);

register(
  'get_bis_credit',
  '获取BIS各国信贷占GDP比率数据（衡量各国债务风险水平）',
  {},
  undefined,
  async () => {
    const { getBisCredit } = await import('../../economic/v1/get-bis-credit.ts');
    return getBisCredit(stubCtx(), {} as any);
  },
);

// ========================================================================
// Trade
// ========================================================================

register(
  'get_trade_flows',
  '查询WTO双边贸易流量数据（出口/进口金额和同比变化）',
  {
    reporterCountry: { type: 'string', description: 'Reporter country code (WTO numeric or name)' },
    partnerCountry: { type: 'string', description: 'Partner country code' },
  },
  undefined,
  async (args) => {
    const { getTradeFlows } = await import('../../trade/v1/get-trade-flows.ts');
    return getTradeFlows(stubCtx(), {
      reporterCountry: args.reporterCountry as string ?? '',
      partnerCountry: args.partnerCountry as string ?? '',
    } as any);
  },
);

register(
  'get_trade_barriers',
  '查询WTO关税壁垒分析（农业vs非农业关税差距和最高税率）',
  {
    countryCode: { type: 'string', description: 'Reporter country code' },
  },
  undefined,
  async (args) => {
    const { getTradeBarriers } = await import('../../trade/v1/get-trade-barriers.ts');
    return getTradeBarriers(stubCtx(), { countryCode: args.countryCode as string ?? '' } as any);
  },
);

register(
  'get_tariff_trends',
  '查询WTO MFN平均关税趋势数据',
  {
    reporterCountry: { type: 'string', description: 'Reporter country code' },
    partnerCountry: { type: 'string', description: 'Partner country code' },
  },
  undefined,
  async (args) => {
    const { getTariffTrends } = await import('../../trade/v1/get-tariff-trends.ts');
    return getTariffTrends(stubCtx(), {
      reporterCountry: args.reporterCountry as string ?? '',
      partnerCountry: args.partnerCountry as string ?? '',
    } as any);
  },
);

register(
  'get_trade_restrictions',
  '查询WTO贸易限制概览（基于关税数据的贸易壁垒代理指标）',
  {},
  undefined,
  async () => {
    const { getTradeRestrictions } = await import('../../trade/v1/get-trade-restrictions.ts');
    return getTradeRestrictions(stubCtx(), {} as any);
  },
);

// ========================================================================
// Prediction Markets
// ========================================================================

register(
  'fetch_kalshi_markets',
  '获取Kalshi预测市场数据（地缘政治/冲突相关市场）',
  {
    limit: { type: 'number', description: 'Max markets to return (max 200)' },
    cursor: { type: 'string', description: 'Pagination cursor' },
  },
  undefined,
  async (args) => {
    const { fetchKalshiMarkets } = await import('../../kalshi/v1/kalshi.ts');
    return fetchKalshiMarkets(args.limit as number ?? 20, args.cursor as string | undefined);
  },
);

register(
  'fetch_metaculus_questions',
  '获取Metaculus预测问题（地缘政治类别的开放预测问题）',
  {
    limit: { type: 'number', description: 'Max questions to return (max 100)' },
    offset: { type: 'number', description: 'Pagination offset' },
  },
  undefined,
  async (args) => {
    const { fetchMetaculusQuestions } = await import('../../metaculus/v1/metaculus.ts');
    return fetchMetaculusQuestions(args.limit as number ?? 20, args.offset as number ?? 0);
  },
);

// ========================================================================
// Aviation
// ========================================================================

register(
  'list_airport_delays',
  '获取全球机场延误和关闭信息（FAA + 国际机场NOTAM数据）',
  {},
  undefined,
  async () => {
    const { listAirportDelays } = await import('../../aviation/v1/list-airport-delays.ts');
    return listAirportDelays(stubCtx(), {} as any);
  },
);

// ========================================================================
// Government Data
// ========================================================================

register(
  'list_notams',
  '查询FAA NOTAM航空通告（支持位置、分类、半径筛选）',
  {
    locationIdent: { type: 'string', description: 'Airport/FIR identifier, e.g. "KJFK"' },
    classification: { type: 'string', description: 'NOTAM classification' },
    radius: { type: 'number', description: 'Search radius in NM' },
  },
  undefined,
  async (args) => {
    const { listNotams } = await import('../../govdata/v1/notam.ts');
    return listNotams(stubCtx(), {
      locationIdent: args.locationIdent as string ?? '',
      classification: args.classification as string ?? '',
      radius: args.radius as number ?? 0,
    } as any);
  },
);

// ========================================================================
// Maritime
// ========================================================================

register(
  'get_vessel_snapshot',
  '获取全球AIS船舶快照数据（船舶密度区域和AIS异常检测）',
  {},
  undefined,
  async () => {
    const { getVesselSnapshot } = await import('../../maritime/v1/get-vessel-snapshot.ts');
    return getVesselSnapshot(stubCtx(), {} as any);
  },
);

register(
  'list_navigational_warnings',
  '获取NGA航行警告（全球海上安全通告）',
  {
    area: { type: 'string', description: 'NAVAREA filter, e.g. "XII"' },
  },
  undefined,
  async (args) => {
    const { listNavigationalWarnings } = await import('../../maritime/v1/list-navigational-warnings.ts');
    return listNavigationalWarnings(stubCtx(), { area: args.area as string ?? '' } as any);
  },
);

// ========================================================================
// Infrastructure
// ========================================================================

register(
  'list_internet_outages',
  '获取全球互联网中断事件（数据源：Cloudflare Radar）',
  {},
  undefined,
  async () => {
    const { listInternetOutages } = await import('../../infrastructure/v1/list-internet-outages.ts');
    return listInternetOutages(stubCtx(), {} as any);
  },
);

register(
  'get_cable_health',
  '获取海底光缆健康状态（基于NGA航行警告中的光缆相关信息）',
  {},
  undefined,
  async () => {
    const { getCableHealth } = await import('../../infrastructure/v1/get-cable-health.ts');
    return getCableHealth(stubCtx(), {} as any);
  },
);

register(
  'list_service_statuses',
  '获取主要云服务/开发平台运行状态（AWS、Azure、GitHub等）',
  {},
  undefined,
  async () => {
    const { listServiceStatuses } = await import('../../infrastructure/v1/list-service-statuses.ts');
    return listServiceStatuses(stubCtx(), {} as any);
  },
);

// ========================================================================
// Cyber
// ========================================================================

register(
  'list_cyber_threats',
  '获取网络威胁情报（C2服务器、恶意URL、IOC指标，来源：Feodo/URLhaus/OTX等）',
  {
    limit: { type: 'number', description: 'Max threats to return' },
    days: { type: 'number', description: 'Number of days to look back' },
    cursor: { type: 'string', description: 'Pagination cursor' },
  },
  undefined,
  async (args) => {
    const { listCyberThreats } = await import('../../cyber/v1/list-cyber-threats.ts');
    return listCyberThreats(stubCtx(), {
      limit: args.limit as number ?? 50,
      days: args.days as number ?? 7,
      cursor: args.cursor as string ?? '',
    } as any);
  },
);

// ========================================================================
// Supply Chain
// ========================================================================

register(
  'get_shipping_rates',
  '获取航运费率指数（深海货运PPI、货运运输指数，数据源：FRED）',
  {},
  undefined,
  async () => {
    const { getShippingRates } = await import('../../supply-chain/v1/get-shipping-rates.ts');
    return getShippingRates(stubCtx(), {} as any);
  },
);

register(
  'get_critical_minerals',
  '获取关键矿产供应链数据（锂、钴、稀土等的产量集中度和风险评级）',
  {},
  undefined,
  async () => {
    const { getCriticalMinerals } = await import('../../supply-chain/v1/get-critical-minerals.ts');
    return getCriticalMinerals(stubCtx(), {} as any);
  },
);

register(
  'get_chokepoint_status',
  '获取全球海上咽喉要道状态（苏伊士、霍尔木兹、马六甲等通行风险评估）',
  {},
  undefined,
  async () => {
    const { getChokepointStatus } = await import('../../supply-chain/v1/get-chokepoint-status.ts');
    return getChokepointStatus(stubCtx(), {} as any);
  },
);

// ========================================================================
// Displacement
// ========================================================================

register(
  'get_displacement_summary',
  '获取全球难民和流离失所者数据汇总（数据源：UNHCR Population API）',
  {
    year: { type: 'number', description: 'Data year' },
  },
  undefined,
  async (args) => {
    const { getDisplacementSummary } = await import('../../displacement/v1/get-displacement-summary.ts');
    return getDisplacementSummary(stubCtx(), { year: args.year as number ?? 0 } as any);
  },
);

register(
  'get_population_exposure',
  '获取人口暴露度数据（指定地点半径内的人口估算或各国人口概览）',
  {
    mode: { type: 'string', enum: ['exposure', 'countries'], description: '"exposure" for radius calc, "countries" for overview' },
    lat: { type: 'number', description: 'Latitude (for exposure mode)' },
    lon: { type: 'number', description: 'Longitude (for exposure mode)' },
    radiusKm: { type: 'number', description: 'Radius in km (for exposure mode)' },
  },
  undefined,
  async (args) => {
    const { getPopulationExposure } = await import('../../displacement/v1/get-population-exposure.ts');
    return getPopulationExposure(stubCtx(), {
      mode: args.mode as string ?? 'countries',
      lat: args.lat as number ?? 0,
      lon: args.lon as number ?? 0,
      radiusKm: args.radiusKm as number ?? 0,
    } as any);
  },
);

// ========================================================================
// Unrest
// ========================================================================

register(
  'list_unrest_events',
  '获取社会动荡事件（合并ACLED和GDELT数据，支持时间范围和国家筛选）',
  {
    country: { type: 'string', description: 'Country filter' },
    start: { type: 'number', description: 'Start timestamp (ms)' },
    end: { type: 'number', description: 'End timestamp (ms)' },
  },
  undefined,
  async (args) => {
    const { listUnrestEvents } = await import('../../unrest/v1/list-unrest-events.ts');
    return listUnrestEvents(stubCtx(), {
      country: args.country as string ?? '',
      start: args.start as number ?? 0,
      end: args.end as number ?? 0,
    } as any);
  },
);

// ========================================================================
// Trajectory
// ========================================================================

register(
  'query_flight_history',
  '查询飞机历史轨迹（OpenSky REST API，按ICAO24地址查最近航迹）',
  {
    icao24: { type: 'string', description: 'ICAO 24-bit hex address, e.g. "ae1234"' },
    time: { type: 'number', description: 'Unix timestamp for snapshot (0 = current)' },
  },
  ['icao24'],
  async (args) => {
    const { queryFlightHistory } = await import('../../trajectory/v1/flight-history.ts');
    return queryFlightHistory(stubCtx(), { icao24: args.icao24 as string, time: args.time as number ?? 0 } as any);
  },
);

// ========================================================================
// Research
// ========================================================================

register(
  'list_trending_repos',
  '获取GitHub热门趋势仓库（支持语言和时间段筛选）',
  {
    language: { type: 'string', description: 'Programming language, e.g. "python"' },
    period: { type: 'string', enum: ['daily', 'weekly', 'monthly'], description: 'Trending period' },
    pageSize: { type: 'number', description: 'Number of repos (max 100)' },
  },
  undefined,
  async (args) => {
    const { listTrendingRepos } = await import('../../research/v1/list-trending-repos.ts');
    return listTrendingRepos(stubCtx(), {
      language: args.language as string ?? 'python',
      period: args.period as string ?? 'daily',
      pageSize: args.pageSize as number ?? 50,
    } as any);
  },
);

register(
  'list_hackernews_items',
  '获取Hacker News热门文章（支持top/new/best/ask/show/job类别）',
  {
    feedType: { type: 'string', enum: ['top', 'new', 'best', 'ask', 'show', 'job'], description: 'Feed type' },
    pageSize: { type: 'number', description: 'Number of items (max 100)' },
  },
  undefined,
  async (args) => {
    const { listHackernewsItems } = await import('../../research/v1/list-hackernews-items.ts');
    return listHackernewsItems(stubCtx(), {
      feedType: args.feedType as string ?? 'top',
      pageSize: args.pageSize as number ?? 30,
    } as any);
  },
);

// ========================================================================
// Positive Events
// ========================================================================

register(
  'list_positive_geo_events',
  '获取全球正面地理新闻事件（突破性发现、人道援助、环保进展等）',
  {},
  undefined,
  async () => {
    const { listPositiveGeoEvents } = await import('../../positive-events/v1/list-positive-geo-events.ts');
    return listPositiveGeoEvents(stubCtx(), {} as any);
  },
);

// ========================================================================
// Analyst (JP 3-60)
// ========================================================================

register(
  'run_assessment',
  '运行JP 3-60军事情报分析评估（6维度结构化分析，使用Claude Sonnet 4）',
  {
    query: { type: 'string', description: 'Assessment query / question' },
    region: { type: 'string', description: 'Geographic region' },
    timeframe: { type: 'string', description: 'Analysis timeframe, e.g. "30 days"' },
    evidence: { type: 'array', items: { type: 'string' }, description: 'Evidence strings to include' },
  },
  ['query', 'region', 'timeframe'],
  async (args) => {
    const { handleAssessment } = await import('../../analyst/v1/assessment.ts');
    return handleAssessment({
      query: args.query as string,
      region: args.region as string,
      timeframe: args.timeframe as string,
      evidence: args.evidence as string[] ?? [],
    });
  },
);

// ========================================================================
// Exports
// ========================================================================

/** Tool definitions WITHOUT execute fn — safe for serialization to Claude API. */
export const TOOL_DEFINITIONS: ToolDefinition[] = registry.map(({ execute: _, ...def }) => def);

/**
 * Execute a tool call by name.
 * Returns the handler result on success or { error: string } on failure.
 */
export async function executeToolCall(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const entry = registry.find((t) => t.name === name);
  if (!entry) {
    return { error: `Unknown tool: ${name}` };
  }
  try {
    return await entry.execute(args);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `Tool ${name} failed: ${message}` };
  }
}
