# Intelligence Assistant Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a conversational AI assistant (Chat Panel + Daily Briefing) that queries all ~70 Omni Sentinel data sources via Claude tool use, embedded in the map UI.

**Architecture:** Claude Sonnet 4 with tool_use — all existing RPC handlers registered as tools. Edge Function runs the tool-use loop: receives Claude's tool calls, invokes handlers directly (no HTTP round-trip), returns results for Claude to synthesize. Multi-turn chat with session-only history. Briefing uses fixed framework prompt.

**Tech Stack:** Anthropic Claude Messages API (tool_use), Vercel Edge Functions, TypeScript, vanilla DOM Panel, sebuf proto codegen, node:test.

---

## Task 1: Proto Definitions

**Files:**
- Create: `proto/worldmonitor/intel/v1/chat.proto`
- Create: `proto/worldmonitor/intel/v1/briefing.proto`
- Create: `proto/worldmonitor/intel/v1/service.proto`

**Step 1: Create chat.proto**

```protobuf
syntax = "proto3";
package worldmonitor.intel.v1;

message ChatMessage {
  string role = 1;     // "user" | "assistant"
  string content = 2;
}

message ChatRequest {
  repeated ChatMessage messages = 1;
  string region = 2;   // optional focus region
}

message ChatResponse {
  string status = 1;          // "ok" | "error"
  string reply = 2;           // Claude's response (markdown)
  repeated string tools_used = 3;
  int32 tokens_used = 4;
  string disclaimer = 5;
  string error_message = 6;
}
```

**Step 2: Create briefing.proto**

```protobuf
syntax = "proto3";
package worldmonitor.intel.v1;

message BriefingSection {
  string title = 1;
  string content = 2;         // markdown
  repeated string sources = 3;
}

message BriefingRequest {
  repeated string focus_regions = 1;
  string language = 2;        // "zh" | "en", default "zh"
}

message BriefingResponse {
  string status = 1;
  repeated BriefingSection sections = 2;
  int64 generated_at = 3;
  int32 tokens_used = 4;
  string disclaimer = 5;
  string error_message = 6;
}
```

**Step 3: Create service.proto**

```protobuf
syntax = "proto3";
package worldmonitor.intel.v1;

import "sebuf/http/annotations.proto";
import "worldmonitor/intel/v1/chat.proto";
import "worldmonitor/intel/v1/briefing.proto";

service IntelService {
  option (sebuf.http.service_config) = {base_path: "/api/intel/v1"};

  rpc Chat(ChatRequest) returns (ChatResponse) {
    option (sebuf.http.config) = {path: "/chat", method: HTTP_METHOD_POST};
  }

  rpc Briefing(BriefingRequest) returns (BriefingResponse) {
    option (sebuf.http.config) = {path: "/briefing", method: HTTP_METHOD_POST};
  }
}
```

**Step 4: Run codegen**

Run: `npx buf generate proto/`
Expected: Generates `src/generated/server/worldmonitor/intel/v1/service_server.ts` and `src/generated/client/worldmonitor/intel/v1/service_client.ts`

If `buf` is not installed or the above fails, manually create the generated files following the exact pattern in `src/generated/server/worldmonitor/analyst/v1/service_server.ts`. The codegen produces:
- Server: interfaces for request/response, `ServerContext`, handler interface, `createIntelServiceRoutes()` function
- Client: same interfaces plus `IntelServiceClient` class with `chat()` and `briefing()` methods

**Step 5: Commit**

```bash
git add proto/worldmonitor/intel/v1/ src/generated/server/worldmonitor/intel/v1/ src/generated/client/worldmonitor/intel/v1/
git commit -m "feat(intel): add proto definitions for Chat + Briefing service"
```

---

## Task 2: System Prompts

**Files:**
- Create: `server/worldmonitor/intel/v1/system-prompts.ts`

**Step 1: Write the failing test**

Create test file `server/worldmonitor/intel/v1/system-prompts.test.mts`:

```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CHAT_SYSTEM_PROMPT, BRIEFING_SYSTEM_PROMPT, INTEL_DISCLAIMER } from './system-prompts.ts';

describe('system-prompts', () => {
  it('CHAT_SYSTEM_PROMPT is non-empty and contains key instructions', () => {
    assert.ok(CHAT_SYSTEM_PROMPT.length > 100, 'Chat prompt should be substantial');
    assert.ok(CHAT_SYSTEM_PROMPT.includes('中文'), 'Should mention Chinese language');
    assert.ok(CHAT_SYSTEM_PROMPT.includes('数据'), 'Should mention data');
  });

  it('BRIEFING_SYSTEM_PROMPT contains all 5 framework sections', () => {
    assert.ok(BRIEFING_SYSTEM_PROMPT.includes('热点地区'), 'Should have hotspot section');
    assert.ok(BRIEFING_SYSTEM_PROMPT.includes('金融市场'), 'Should have financial section');
    assert.ok(BRIEFING_SYSTEM_PROMPT.includes('旅行安全'), 'Should have travel safety section');
    assert.ok(BRIEFING_SYSTEM_PROMPT.includes('预测市场'), 'Should have prediction section');
    assert.ok(BRIEFING_SYSTEM_PROMPT.includes('值得关注'), 'Should have watchlist section');
  });

  it('INTEL_DISCLAIMER mentions AI-generated', () => {
    assert.ok(INTEL_DISCLAIMER.includes('AI'), 'Disclaimer should mention AI');
    assert.ok(INTEL_DISCLAIMER.length > 20, 'Disclaimer should be meaningful');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx tsx --test server/worldmonitor/intel/v1/system-prompts.test.mts`
Expected: FAIL — module not found

**Step 3: Write implementation**

Create `server/worldmonitor/intel/v1/system-prompts.ts`:

```typescript
export const INTEL_DISCLAIMER =
  'This is AI-generated analysis based on publicly available data. It should not be used as the sole basis for any decision. Always verify with authoritative sources.';

export const CHAT_SYSTEM_PROMPT = `你是 Omni Sentinel 的情报分析师。你可以使用多种数据工具来回答用户的问题。

工作方式：
1. 如果用户的问题太笼统，先问澄清问题（地区？时间范围？关注点？具体哪方面？）
2. 决定需要查询哪些数据源，调用相关工具
3. 基于获取的数据，用中文综合分析，给出有依据的回答
4. 引用数据来源名称

回答规范：
- 用中文回答，技术术语和专有名词保留英文（如 ACLED, GDELT, Kalshi）
- 明确区分事实（来自数据）和你的分析/推断
- 如果数据不足，坦诚说明，不要编造
- 关于人物查询：使用新闻、社交媒体、制裁名单搜索公开信息
- 每次回答结尾标注数据时效性

你的工具覆盖以下领域：
- 冲突与安全: ACLED武装冲突、UCDP事件、社会骚乱、军事飞行、海军舰队
- 金融市场: 股票指数、加密货币、大宗商品、ETF资金流、海湾市场
- 经济数据: 央行利率、能源价格、贸易壁垒、世界银行指标
- 情报分析: GDELT全球新闻、国家风险评分、情报简报
- 社交媒体: Reddit, X/Twitter, Bluesky, YouTube, TikTok, VK
- 新闻: RSS新闻摘要、文章摘要
- 预测市场: Kalshi, Metaculus
- 航空: 机场延误、NOTAM通告、飞行轨迹
- 海事: 船舶追踪、航行警告
- 基础设施: 互联网中断、网络威胁、海底电缆
- 供应链: 海运费率、关键矿产、咽喉要道
- 人道主义: 难民流离失所、人口暴露评估
- 制裁: OpenSanctions制裁名单查询

注意：你只能查询公开数据。无法追踪个人私人信息。`;

export const BRIEFING_SYSTEM_PROMPT = `你是 Omni Sentinel 的情报分析师。请生成一份综合情报简报，按以下固定框架组织。

对于每个章节，调用相关的数据工具获取最新数据，然后进行分析。

## 热点地区动态
调用冲突和军事相关工具（get_conflicts, get_military_flights, get_intel_brief, search_gdelt），总结当前最重要的3-5个地缘政治事件。每个事件说明：什么发生了、影响范围、发展趋势。

## 金融市场影响
调用市场和经济工具（get_market_overview, get_commodity_prices, get_crypto_prices, get_economic_indicators），分析地缘事件对金融市场的潜在影响。包括：主要股指走势、大宗商品（石油/黄金）、加密货币。

## 旅行安全评估
调用航空和安全工具（get_airport_delays, get_notams, get_unrest_events, get_conflicts），给出主要地区的安全等级评估。对有风险的地区给出具体建议。

## 预测市场信号
调用预测市场工具（get_predictions_kalshi, get_predictions_metaculus），列出与当前热点最相关的预测市场问题及其概率。

## 值得关注
综合所有获取到的数据，列出3-5个值得持续关注的信号（异常波动、新趋势、潜在风险）。

撰写规范：
- 中文撰写，技术术语保留英文
- 每段引用具体数据来源工具名
- 标注数据时效性
- 保持客观，区分事实与分析
- 控制总长度在 1500-2500 字`;
```

**Step 4: Run test to verify it passes**

Run: `npx tsx --test server/worldmonitor/intel/v1/system-prompts.test.mts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add server/worldmonitor/intel/v1/system-prompts.ts server/worldmonitor/intel/v1/system-prompts.test.mts
git commit -m "feat(intel): add system prompts for chat and briefing"
```

---

## Task 3: Tool Registry

This is the core mapping from Claude tool definitions to internal RPC handlers.

**Files:**
- Create: `server/worldmonitor/intel/v1/tools.ts`
- Create: `server/worldmonitor/intel/v1/tools.test.mts`

**Step 1: Write the failing test**

Create `server/worldmonitor/intel/v1/tools.test.mts`:

```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TOOL_DEFINITIONS, executeToolCall, type ToolDefinition } from './tools.ts';

describe('tool registry', () => {
  it('exports at least 30 tool definitions', () => {
    assert.ok(TOOL_DEFINITIONS.length >= 30, `Expected >= 30 tools, got ${TOOL_DEFINITIONS.length}`);
  });

  it('every tool has name, description, and input_schema', () => {
    for (const tool of TOOL_DEFINITIONS) {
      assert.ok(tool.name, `Tool missing name`);
      assert.ok(tool.description, `Tool ${tool.name} missing description`);
      assert.ok(tool.input_schema, `Tool ${tool.name} missing input_schema`);
      assert.strictEqual(tool.input_schema.type, 'object', `Tool ${tool.name} schema type should be object`);
    }
  });

  it('tool names are unique', () => {
    const names = TOOL_DEFINITIONS.map(t => t.name);
    const unique = new Set(names);
    assert.strictEqual(names.length, unique.size, `Duplicate tool names found`);
  });

  it('tool names use snake_case', () => {
    for (const tool of TOOL_DEFINITIONS) {
      assert.ok(/^[a-z][a-z0-9_]*$/.test(tool.name), `Tool name ${tool.name} should be snake_case`);
    }
  });

  it('executeToolCall returns error object for unknown tool', async () => {
    const result = await executeToolCall('nonexistent_tool', {});
    assert.ok(typeof result === 'object');
    assert.ok('error' in (result as any));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx tsx --test server/worldmonitor/intel/v1/tools.test.mts`
Expected: FAIL — module not found

**Step 3: Write implementation**

Create `server/worldmonitor/intel/v1/tools.ts`.

This file maps every existing RPC handler to a Claude tool definition. Each tool definition follows the Anthropic tool_use schema: `{ name, description, input_schema }`.

The `executeToolCall` function takes a tool name + arguments, imports the corresponding handler, calls it with a mock ServerContext, and returns the result.

```typescript
/**
 * Tool registry — maps Claude tool_use names to Omni Sentinel RPC handlers.
 *
 * Each tool has:
 *   - name: snake_case identifier sent to Claude
 *   - description: what the tool does (Claude reads this to decide when to use it)
 *   - input_schema: JSON Schema for the tool's parameters
 *   - handler: path to import + function name (used by executeToolCall)
 */

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: { type: 'object'; properties: Record<string, any>; required?: string[] };
}

interface ToolRegistryEntry extends ToolDefinition {
  execute: (args: Record<string, any>) => Promise<any>;
}

// Stub ServerContext for internal calls (no real HTTP request)
const STUB_CTX = {
  request: new Request('http://localhost'),
  pathParams: {},
  headers: {},
};

// ============================================================================
// Tool definitions — grouped by domain
// ============================================================================

const registry: ToolRegistryEntry[] = [];

function register(
  name: string,
  description: string,
  schema: ToolDefinition['input_schema'],
  execute: (args: Record<string, any>) => Promise<any>,
): void {
  registry.push({ name, description, input_schema: schema, execute });
}

// --- Conflict & Security ---
register('get_conflicts', '获取全球武装冲突事件 (ACLED + UCDP)。可按国家和时间范围筛选。', {
  type: 'object',
  properties: {
    country: { type: 'string', description: '国家名称（英文），如 "Ukraine", "Syria"' },
    days: { type: 'number', description: '查询最近N天的事件，默认30' },
  },
}, async (args) => {
  const { listAcledEvents } = await import('../../conflict/v1/list-acled-events');
  const now = Date.now();
  const days = args.days ?? 30;
  return listAcledEvents(STUB_CTX, {
    start: now - days * 86400000, end: now,
    country: args.country ?? '', limit: 20, offset: 0,
  });
});

register('get_iran_events', '获取伊朗相关冲突与军事事件。', {
  type: 'object',
  properties: { days: { type: 'number', description: '最近N天，默认30' } },
}, async (args) => {
  const { listIranEvents } = await import('../../conflict/v1/list-iran-events');
  const now = Date.now();
  return listIranEvents(STUB_CTX, { start: now - (args.days ?? 30) * 86400000, end: now, limit: 20, offset: 0 });
});

register('get_humanitarian_summary', '获取指定国家的人道主义摘要。', {
  type: 'object',
  properties: { country: { type: 'string', description: '国家名称' } },
  required: ['country'],
}, async (args) => {
  const { getHumanitarianSummary } = await import('../../conflict/v1/get-humanitarian-summary');
  return getHumanitarianSummary(STUB_CTX, { country: args.country });
});

// --- Military ---
register('get_military_flights', '获取当前军事飞行活动。按区域筛选。', {
  type: 'object',
  properties: { region: { type: 'string', description: '区域如 "europe", "middle-east"' } },
}, async (args) => {
  const { listMilitaryFlights } = await import('../../military/v1/list-military-flights');
  return listMilitaryFlights(STUB_CTX, { region: args.region ?? '' });
});

register('get_military_bases', '获取军事基地信息。', {
  type: 'object',
  properties: { country: { type: 'string', description: '国家名称' } },
}, async (args) => {
  const { listMilitaryBases } = await import('../../military/v1/list-military-bases');
  return listMilitaryBases(STUB_CTX, { country: args.country ?? '' });
});

register('get_theater_posture', '获取战区军事态势分析。', {
  type: 'object',
  properties: { theater: { type: 'string', description: '战区如 "CENTCOM", "INDOPACOM", "EUCOM"' } },
  required: ['theater'],
}, async (args) => {
  const { getTheaterPosture } = await import('../../military/v1/get-theater-posture');
  return getTheaterPosture(STUB_CTX, { theater: args.theater });
});

register('get_fleet_report', '获取美国海军舰队位置报告 (USNI)。', {
  type: 'object', properties: {},
}, async () => {
  const { getUsniFleetReport } = await import('../../military/v1/get-usni-fleet-report');
  return getUsniFleetReport(STUB_CTX, {});
});

register('get_aircraft_details', '查询特定军用飞机详细信息。', {
  type: 'object',
  properties: { icao24: { type: 'string', description: 'ICAO24 hex代码' } },
  required: ['icao24'],
}, async (args) => {
  const { getAircraftDetails } = await import('../../military/v1/get-aircraft-details');
  return getAircraftDetails(STUB_CTX, { icao24: args.icao24 });
});

// --- Intelligence ---
register('search_gdelt', '搜索 GDELT 全球新闻事件数据库。可按关键词、国家筛选。', {
  type: 'object',
  properties: {
    query: { type: 'string', description: '搜索关键词' },
    country: { type: 'string', description: '国家代码如 "US", "CN", "RU"' },
    max_records: { type: 'number', description: '最大记录数，默认10' },
  },
  required: ['query'],
}, async (args) => {
  const { searchGdeltDocuments } = await import('../../intelligence/v1/search-gdelt-documents');
  return searchGdeltDocuments(STUB_CTX, {
    query: args.query, sourceCountry: args.country ?? '',
    maxRecords: args.max_records ?? 10, timespan: '',
  });
});

register('get_risk_scores', '获取国家风险评分（政治稳定性、安全、经济等）。', {
  type: 'object',
  properties: { country: { type: 'string', description: '国家名称' } },
  required: ['country'],
}, async (args) => {
  const { getRiskScores } = await import('../../intelligence/v1/get-risk-scores');
  return getRiskScores(STUB_CTX, { country: args.country });
});

register('get_intel_brief', '获取国家情报简报。', {
  type: 'object',
  properties: { country: { type: 'string', description: '国家名称' } },
  required: ['country'],
}, async (args) => {
  const { getCountryIntelBrief } = await import('../../intelligence/v1/get-country-intel-brief');
  return getCountryIntelBrief(STUB_CTX, { country: args.country });
});

// --- Social Media ---
register('search_reddit', '搜索 Reddit 帖子。可指定 subreddit 和查询关键词。', {
  type: 'object',
  properties: {
    query: { type: 'string', description: '搜索关键词' },
    subreddit: { type: 'string', description: 'subreddit名称如 "geopolitics", "worldnews"' },
    limit: { type: 'number', description: '结果数，默认10' },
  },
}, async (args) => {
  const { listRedditPosts } = await import('../../social/v1/reddit');
  return listRedditPosts(STUB_CTX, {
    query: args.query ?? '', subreddits: args.subreddit ? [args.subreddit] : [],
    limit: args.limit ?? 10, sort: 'hot',
  });
});

register('search_twitter', '搜索 X/Twitter 帖子。', {
  type: 'object',
  properties: {
    query: { type: 'string', description: '搜索关键词' },
    limit: { type: 'number', description: '结果数，默认10' },
  },
  required: ['query'],
}, async (args) => {
  const { listTweets } = await import('../../social/v1/twitter');
  return listTweets(STUB_CTX, { query: args.query, limit: args.limit ?? 10 });
});

register('search_bluesky', '搜索 Bluesky 帖子。', {
  type: 'object',
  properties: {
    query: { type: 'string', description: '搜索关键词' },
    limit: { type: 'number', description: '结果数，默认10' },
  },
  required: ['query'],
}, async (args) => {
  const { listBlueskyPosts } = await import('../../social/v1/bluesky');
  return listBlueskyPosts(STUB_CTX, { query: args.query, limit: args.limit ?? 10 });
});

register('search_youtube', '搜索 YouTube 视频。', {
  type: 'object',
  properties: {
    query: { type: 'string', description: '搜索关键词' },
    limit: { type: 'number', description: '结果数，默认5' },
  },
  required: ['query'],
}, async (args) => {
  const { listYoutubeVideos } = await import('../../social/v1/youtube');
  return listYoutubeVideos(STUB_CTX, { query: args.query, maxResults: args.limit ?? 5 });
});

register('search_tiktok', '搜索 TikTok 帖子。', {
  type: 'object',
  properties: {
    query: { type: 'string', description: '搜索关键词' },
    limit: { type: 'number', description: '结果数，默认10' },
  },
  required: ['query'],
}, async (args) => {
  const { listTiktokPosts } = await import('../../social/v1/tiktok');
  return listTiktokPosts(STUB_CTX, { query: args.query, limit: args.limit ?? 10 });
});

register('search_vk', '搜索 VK（俄罗斯社交平台）帖子。', {
  type: 'object',
  properties: {
    query: { type: 'string', description: '搜索关键词' },
    limit: { type: 'number', description: '结果数，默认10' },
  },
  required: ['query'],
}, async (args) => {
  const { listVkPosts } = await import('../../social/v1/vk');
  return listVkPosts(STUB_CTX, { query: args.query, limit: args.limit ?? 10 });
});

// --- News ---
register('search_news', '搜索 RSS 新闻摘要。按区域或关键词筛选。', {
  type: 'object',
  properties: {
    region: { type: 'string', description: '区域如 "middle-east", "east-asia"' },
    limit: { type: 'number', description: '结果数，默认10' },
  },
}, async (args) => {
  const { listFeedDigest } = await import('../../news/v1/list-feed-digest');
  return listFeedDigest(STUB_CTX, { region: args.region ?? '', limit: args.limit ?? 10, offset: 0 });
});

register('summarize_article', '摘要一篇新闻文章（提供URL）。', {
  type: 'object',
  properties: { url: { type: 'string', description: '文章URL' } },
  required: ['url'],
}, async (args) => {
  const { summarizeArticle } = await import('../../news/v1/summarize-article');
  return summarizeArticle(STUB_CTX, { url: args.url });
});

// --- Market & Economics ---
register('get_market_overview', '获取主要股票指数行情（标普500、纳斯达克、道琼斯等）。', {
  type: 'object',
  properties: {
    symbols: { type: 'string', description: '逗号分隔的代码如 "SPY,QQQ,DIA"。留空获取默认主要指数。' },
  },
}, async (args) => {
  const { listMarketQuotes } = await import('../../market/v1/list-market-quotes');
  const symbols = args.symbols ? args.symbols.split(',').map((s: string) => s.trim()) : [];
  return listMarketQuotes(STUB_CTX, { symbols });
});

register('get_crypto_prices', '获取加密货币价格（BTC, ETH等）。', {
  type: 'object',
  properties: {
    symbols: { type: 'string', description: '逗号分隔如 "BTC,ETH,SOL"。留空获取主要币种。' },
  },
}, async (args) => {
  const { listCryptoQuotes } = await import('../../market/v1/list-crypto-quotes');
  const symbols = args.symbols ? args.symbols.split(',').map((s: string) => s.trim()) : [];
  return listCryptoQuotes(STUB_CTX, { symbols });
});

register('get_commodity_prices', '获取大宗商品价格（原油、黄金、天然气等）。', {
  type: 'object',
  properties: {
    symbols: { type: 'string', description: '逗号分隔如 "CL=F,GC=F"。留空获取主要商品。' },
  },
}, async (args) => {
  const { listCommodityQuotes } = await import('../../market/v1/list-commodity-quotes');
  const symbols = args.symbols ? args.symbols.split(',').map((s: string) => s.trim()) : [];
  return listCommodityQuotes(STUB_CTX, { symbols });
});

register('get_etf_flows', '获取 ETF 资金流向数据。', {
  type: 'object', properties: {},
}, async () => {
  const { listEtfFlows } = await import('../../market/v1/list-etf-flows');
  return listEtfFlows(STUB_CTX, {});
});

register('get_gulf_markets', '获取海湾地区市场行情（沙特、阿联酋等）。', {
  type: 'object', properties: {},
}, async () => {
  const { listGulfQuotes } = await import('../../market/v1/list-gulf-quotes');
  return listGulfQuotes(STUB_CTX, {});
});

register('get_sector_summary', '获取股市各板块表现摘要。', {
  type: 'object', properties: {},
}, async () => {
  const { getSectorSummary } = await import('../../market/v1/get-sector-summary');
  return getSectorSummary(STUB_CTX, {});
});

register('get_stablecoin_markets', '获取稳定币市场数据。', {
  type: 'object', properties: {},
}, async () => {
  const { listStablecoinMarkets } = await import('../../market/v1/list-stablecoin-markets');
  return listStablecoinMarkets(STUB_CTX, {});
});

register('get_country_stock_index', '获取指定国家的股票指数。', {
  type: 'object',
  properties: { country: { type: 'string', description: '国家名称或代码' } },
  required: ['country'],
}, async (args) => {
  const { getCountryStockIndex } = await import('../../market/v1/get-country-stock-index');
  return getCountryStockIndex(STUB_CTX, { country: args.country });
});

// --- Economic Data ---
register('get_economic_indicators', '获取宏观经济信号（GDP增长、通胀、失业率等）。', {
  type: 'object',
  properties: { country: { type: 'string', description: '国家代码如 "US", "CN"' } },
}, async (args) => {
  const { getMacroSignals } = await import('../../economic/v1/get-macro-signals');
  return getMacroSignals(STUB_CTX, { country: args.country ?? '' });
});

register('get_energy_prices', '获取全球能源价格（石油、天然气、电力）。', {
  type: 'object', properties: {},
}, async () => {
  const { getEnergyPrices } = await import('../../economic/v1/get-energy-prices');
  return getEnergyPrices(STUB_CTX, {});
});

register('get_central_bank_rates', '获取各国央行政策利率 (BIS)。', {
  type: 'object', properties: {},
}, async () => {
  const { getBisPolicyRates } = await import('../../economic/v1/get-bis-policy-rates');
  return getBisPolicyRates(STUB_CTX, {});
});

register('get_exchange_rates', '获取主要货币汇率 (BIS)。', {
  type: 'object', properties: {},
}, async () => {
  const { getBisExchangeRates } = await import('../../economic/v1/get-bis-exchange-rates');
  return getBisExchangeRates(STUB_CTX, {});
});

register('get_fred_data', '获取美联储经济数据 (FRED)。', {
  type: 'object',
  properties: { series_id: { type: 'string', description: 'FRED series ID如 "GDP", "UNRATE"' } },
  required: ['series_id'],
}, async (args) => {
  const { getFredSeries } = await import('../../economic/v1/get-fred-series');
  return getFredSeries(STUB_CTX, { seriesId: args.series_id });
});

register('get_world_bank_data', '获取世界银行发展指标。', {
  type: 'object',
  properties: {
    country: { type: 'string', description: '国家代码' },
    indicator: { type: 'string', description: '指标代码如 "NY.GDP.MKTP.CD"' },
  },
}, async (args) => {
  const { listWorldBankIndicators } = await import('../../economic/v1/list-world-bank-indicators');
  return listWorldBankIndicators(STUB_CTX, { country: args.country ?? '', indicator: args.indicator ?? '' });
});

// --- Trade ---
register('get_trade_flows', '获取国际贸易流数据。', {
  type: 'object',
  properties: { country: { type: 'string', description: '国家名称' } },
}, async (args) => {
  const { getTradeFlows } = await import('../../trade/v1/get-trade-flows');
  return getTradeFlows(STUB_CTX, { country: args.country ?? '' });
});

register('get_trade_barriers', '获取贸易壁垒和制裁信息。', {
  type: 'object',
  properties: { country: { type: 'string', description: '国家名称' } },
}, async (args) => {
  const { getTradeBarriers } = await import('../../trade/v1/get-trade-barriers');
  return getTradeBarriers(STUB_CTX, { country: args.country ?? '' });
});

register('get_tariff_trends', '获取关税趋势数据。', {
  type: 'object',
  properties: { country: { type: 'string', description: '国家名称' } },
}, async (args) => {
  const { getTariffTrends } = await import('../../trade/v1/get-tariff-trends');
  return getTariffTrends(STUB_CTX, { country: args.country ?? '' });
});

// --- Prediction Markets ---
register('get_predictions_kalshi', '获取 Kalshi 预测市场数据。可按关键词搜索。', {
  type: 'object',
  properties: {
    query: { type: 'string', description: '搜索关键词如 "Iran", "election"' },
    limit: { type: 'number', description: '结果数，默认10' },
  },
}, async (args) => {
  const { listKalshiMarkets } = await import('../../kalshi/v1/kalshi');
  return listKalshiMarkets(STUB_CTX, { query: args.query ?? '', limit: args.limit ?? 10, offset: 0 });
});

register('get_predictions_metaculus', '获取 Metaculus 预测市场数据。', {
  type: 'object',
  properties: {
    query: { type: 'string', description: '搜索关键词' },
    limit: { type: 'number', description: '结果数，默认10' },
  },
}, async (args) => {
  const { fetchMetaculusQuestions } = await import('../../metaculus/v1/metaculus');
  return fetchMetaculusQuestions(args.limit ?? 10, 0);
});

// --- Aviation ---
register('get_airport_delays', '获取机场延误信息。', {
  type: 'object',
  properties: { airport_code: { type: 'string', description: '机场IATA代码如 "JFK", "DXB"' } },
}, async (args) => {
  const { listAirportDelays } = await import('../../aviation/v1/list-airport-delays');
  return listAirportDelays(STUB_CTX, { airportCode: args.airport_code ?? '' });
});

register('get_notams', '获取航空 NOTAM（航行通告）。按区域筛选。', {
  type: 'object',
  properties: {
    location: { type: 'string', description: '位置如 ICAO airport code "KJFK" or FIR code' },
  },
}, async (args) => {
  const { listNotams } = await import('../../govdata/v1/notam');
  return listNotams(STUB_CTX, { location: args.location ?? '', notamType: '' });
});

// --- Maritime ---
register('get_vessel_info', '获取船舶实时位置和信息。', {
  type: 'object',
  properties: { mmsi: { type: 'string', description: '船舶 MMSI 编号' } },
  required: ['mmsi'],
}, async (args) => {
  const { getVesselSnapshot } = await import('../../maritime/v1/get-vessel-snapshot');
  return getVesselSnapshot(STUB_CTX, { mmsi: args.mmsi });
});

register('get_nav_warnings', '获取航行警告（NAVTEX/navigational warnings）。', {
  type: 'object',
  properties: { area: { type: 'string', description: '海域如 "persian_gulf", "south_china_sea"' } },
}, async (args) => {
  const { listNavigationalWarnings } = await import('../../maritime/v1/list-navigational-warnings');
  return listNavigationalWarnings(STUB_CTX, { area: args.area ?? '' });
});

// --- Infrastructure ---
register('get_internet_outages', '获取全球互联网中断事件。', {
  type: 'object',
  properties: { country: { type: 'string', description: '国家名称' } },
}, async (args) => {
  const { listInternetOutages } = await import('../../infrastructure/v1/list-internet-outages');
  return listInternetOutages(STUB_CTX, { country: args.country ?? '' });
});

register('get_cyber_threats', '获取网络安全威胁情报。', {
  type: 'object', properties: {},
}, async () => {
  const { listCyberThreats } = await import('../../cyber/v1/list-cyber-threats');
  return listCyberThreats(STUB_CTX, {});
});

register('get_cable_health', '获取海底电缆健康状态。', {
  type: 'object', properties: {},
}, async () => {
  const { getCableHealth } = await import('../../infrastructure/v1/get-cable-health');
  return getCableHealth(STUB_CTX, {});
});

// --- Supply Chain ---
register('get_shipping_rates', '获取全球海运运价指数。', {
  type: 'object', properties: {},
}, async () => {
  const { getShippingRates } = await import('../../supply-chain/v1/get-shipping-rates');
  return getShippingRates(STUB_CTX, {});
});

register('get_critical_minerals', '获取关键矿产供应信息。', {
  type: 'object', properties: {},
}, async () => {
  const { getCriticalMinerals } = await import('../../supply-chain/v1/get-critical-minerals');
  return getCriticalMinerals(STUB_CTX, {});
});

register('get_chokepoint_status', '获取全球海上咽喉要道通行状态（苏伊士、霍尔木兹等）。', {
  type: 'object', properties: {},
}, async () => {
  const { getChokepointStatus } = await import('../../supply-chain/v1/get-chokepoint-status');
  return getChokepointStatus(STUB_CTX, {});
});

// --- Displacement & Humanitarian ---
register('get_displacement', '获取难民和流离失所人口数据。', {
  type: 'object',
  properties: { country: { type: 'string', description: '国家名称' } },
}, async (args) => {
  const { getDisplacementSummary } = await import('../../displacement/v1/get-displacement-summary');
  return getDisplacementSummary(STUB_CTX, { country: args.country ?? '' });
});

register('get_population_exposure', '获取冲突地区人口暴露评估。', {
  type: 'object',
  properties: { country: { type: 'string', description: '国家名称' } },
}, async (args) => {
  const { getPopulationExposure } = await import('../../displacement/v1/get-population-exposure');
  return getPopulationExposure(STUB_CTX, { country: args.country ?? '' });
});

// --- Unrest ---
register('get_unrest_events', '获取社会骚乱事件（抗议、示威等）。', {
  type: 'object',
  properties: { country: { type: 'string', description: '国家名称' } },
}, async (args) => {
  const { listUnrestEvents } = await import('../../unrest/v1/list-unrest-events');
  return listUnrestEvents(STUB_CTX, { country: args.country ?? '' });
});

// --- Flight Trajectory ---
register('get_flight_trajectory', '获取飞机历史飞行轨迹（需要ICAO24代码）。', {
  type: 'object',
  properties: { icao24: { type: 'string', description: '飞机ICAO24 hex代码' } },
  required: ['icao24'],
}, async (args) => {
  const { queryFlightHistory } = await import('../../trajectory/v1/flight-history');
  return queryFlightHistory(STUB_CTX, { icao24: args.icao24, begin: 0, end: 0 });
});

// --- Research ---
register('get_trending_repos', '获取 GitHub 热门仓库（技术趋势信号）。', {
  type: 'object',
  properties: { language: { type: 'string', description: '编程语言如 "python", "rust"' } },
}, async (args) => {
  const { listTrendingRepos } = await import('../../research/v1/list-trending-repos');
  return listTrendingRepos(STUB_CTX, { language: args.language ?? '', since: 'daily' });
});

register('get_hackernews', '获取 Hacker News 热门讨论。', {
  type: 'object',
  properties: { limit: { type: 'number', description: '结果数，默认10' } },
}, async (args) => {
  const { listHackernewsItems } = await import('../../research/v1/list-hackernews-items');
  return listHackernewsItems(STUB_CTX, { limit: args.limit ?? 10, type: 'top' });
});

// --- Analyst (JP 3-60) ---
register('run_assessment', '运行 JP 3-60 军事分析评估（6维度评分）。用于评估冲突升级概率。', {
  type: 'object',
  properties: {
    query: { type: 'string', description: '分析主题如 "Iran-Israel conflict escalation"' },
    region: { type: 'string', description: '区域如 "middle-east"' },
    timeframe: { type: 'string', description: '时间范围: "7d", "30d", "90d"' },
  },
  required: ['query'],
}, async (args) => {
  const { handleAssessment } = await import('../../analyst/v1/assessment');
  return handleAssessment({
    query: args.query, region: args.region ?? '', timeframe: args.timeframe ?? '30d', evidence: [],
  });
});

// ============================================================================
// Exports
// ============================================================================

/** Tool definitions in Anthropic API format (no execute function). */
export const TOOL_DEFINITIONS: ToolDefinition[] = registry.map(({ execute: _, ...def }) => def);

/**
 * Execute a tool call by name with the given arguments.
 * Returns the tool result object, or an error object if the tool is not found.
 */
export async function executeToolCall(
  toolName: string,
  args: Record<string, any>,
): Promise<any> {
  const entry = registry.find(t => t.name === toolName);
  if (!entry) return { error: `Unknown tool: ${toolName}` };
  try {
    return await entry.execute(args);
  } catch (err) {
    return { error: `Tool ${toolName} failed: ${err instanceof Error ? err.message : 'unknown error'}` };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx tsx --test server/worldmonitor/intel/v1/tools.test.mts`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add server/worldmonitor/intel/v1/tools.ts server/worldmonitor/intel/v1/tools.test.mts
git commit -m "feat(intel): add tool registry mapping ~45 RPCs to Claude tools"
```

---

## Task 4: Chat Handler

The core handler that runs the Claude tool-use loop.

**Files:**
- Create: `server/worldmonitor/intel/v1/chat.ts`
- Create: `server/worldmonitor/intel/v1/chat.test.mts`

**Step 1: Write the failing test**

Create `server/worldmonitor/intel/v1/chat.test.mts`:

```typescript
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { handleChat } from './chat.ts';

describe('handleChat', () => {
  let mockFetch: ReturnType<typeof mock.fn>;
  const originalFetch = globalThis.fetch;
  const originalEnv = process.env.CLAUDE_API_KEY;

  const makeApiResponse = (content: string, usage = { input_tokens: 500, output_tokens: 400 }) => ({
    ok: true,
    json: () => Promise.resolve({
      content: [{ type: 'text', text: content }],
      usage,
      stop_reason: 'end_turn',
    }),
  });

  const makeToolUseResponse = (toolCalls: Array<{ id: string; name: string; input: any }>, usage = { input_tokens: 200, output_tokens: 100 }) => ({
    ok: true,
    json: () => Promise.resolve({
      content: toolCalls.map(tc => ({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input })),
      usage,
      stop_reason: 'tool_use',
    }),
  });

  beforeEach(() => {
    mockFetch = mock.fn(() => Promise.resolve({
      ok: false, status: 500, json: () => Promise.resolve({}),
    }));
    globalThis.fetch = mockFetch as any;
    process.env.CLAUDE_API_KEY = 'test-key';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalEnv !== undefined) process.env.CLAUDE_API_KEY = originalEnv;
    else delete process.env.CLAUDE_API_KEY;
  });

  it('returns reply for simple text response (no tool calls)', async () => {
    mockFetch.mock.mockImplementationOnce(() => Promise.resolve(makeApiResponse('这是一个测试回复。')));
    const result = await handleChat({
      messages: [{ role: 'user', content: '你好' }],
      region: '',
    });
    assert.strictEqual(result.status, 'ok');
    assert.ok(result.reply.includes('测试回复'), 'Reply should contain Claude response');
    assert.ok(result.disclaimer.length > 0, 'Should have disclaimer');
  });

  it('returns error when API key is missing', async () => {
    delete process.env.CLAUDE_API_KEY;
    const result = await handleChat({ messages: [{ role: 'user', content: 'test' }], region: '' });
    assert.strictEqual(result.status, 'error');
    assert.ok(result.errorMessage.includes('API key'));
  });

  it('returns error on API failure', async () => {
    mockFetch.mock.mockImplementationOnce(() => Promise.resolve({ ok: false, status: 503 }));
    const result = await handleChat({ messages: [{ role: 'user', content: 'test' }], region: '' });
    assert.strictEqual(result.status, 'error');
    assert.ok(result.errorMessage.includes('503'));
  });

  it('validates messages array is non-empty', async () => {
    const result = await handleChat({ messages: [], region: '' });
    assert.strictEqual(result.status, 'error');
    assert.ok(result.errorMessage.includes('message'));
  });

  it('includes disclaimer in every response', async () => {
    mockFetch.mock.mockImplementationOnce(() => Promise.resolve(makeApiResponse('test')));
    const result = await handleChat({ messages: [{ role: 'user', content: 'test' }], region: '' });
    assert.ok(result.disclaimer.includes('AI'));
  });

  it('includes disclaimer even on error', async () => {
    delete process.env.CLAUDE_API_KEY;
    const result = await handleChat({ messages: [{ role: 'user', content: 'test' }], region: '' });
    assert.strictEqual(result.status, 'error');
    assert.ok(result.disclaimer.length > 0);
  });

  it('sends tools in API request body', async () => {
    mockFetch.mock.mockImplementationOnce(() => Promise.resolve(makeApiResponse('ok')));
    await handleChat({ messages: [{ role: 'user', content: 'test' }], region: '' });
    const body = JSON.parse(mockFetch.mock.calls[0].arguments[1].body);
    assert.ok(Array.isArray(body.tools), 'Should include tools array');
    assert.ok(body.tools.length > 20, `Should have many tools, got ${body.tools.length}`);
  });

  it('uses Sonnet model', async () => {
    mockFetch.mock.mockImplementationOnce(() => Promise.resolve(makeApiResponse('ok')));
    await handleChat({ messages: [{ role: 'user', content: 'test' }], region: '' });
    const body = JSON.parse(mockFetch.mock.calls[0].arguments[1].body);
    assert.ok(body.model.includes('sonnet'), `Expected sonnet model, got: ${body.model}`);
  });

  it('enforces maximum turns to prevent infinite loops', async () => {
    // Simulate Claude always requesting tool use (would loop forever without max turns)
    mockFetch.mock.mockImplementation(() =>
      Promise.resolve(makeToolUseResponse([{ id: 'call_1', name: 'nonexistent_tool', input: {} }])),
    );
    const result = await handleChat({ messages: [{ role: 'user', content: 'test' }], region: '' });
    // Should eventually stop and return whatever it has
    assert.ok(result.status === 'ok' || result.status === 'error');
    assert.ok(mockFetch.mock.calls.length <= 10, 'Should not exceed max turns');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx tsx --test server/worldmonitor/intel/v1/chat.test.mts`
Expected: FAIL — module not found

**Step 3: Write implementation**

Create `server/worldmonitor/intel/v1/chat.ts`:

```typescript
import { TOOL_DEFINITIONS, executeToolCall } from './tools';
import { CHAT_SYSTEM_PROMPT, INTEL_DISCLAIMER } from './system-prompts';
import { trackUsage } from '../../claude/v1/spend-tracker';

const SONNET_MODEL = 'claude-sonnet-4-20250514';
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const MAX_TOOL_TURNS = 5;
const TIMEOUT_MS = 60_000; // 60s — tool use can take longer

interface ChatMessage {
  role: string;
  content: string;
}

interface ChatInput {
  messages: ChatMessage[];
  region: string;
}

interface ChatOutput {
  status: string;
  reply: string;
  toolsUsed: string[];
  tokensUsed: number;
  disclaimer: string;
  errorMessage: string;
}

const ERROR_RESULT: ChatOutput = {
  status: 'error', reply: '', toolsUsed: [], tokensUsed: 0,
  disclaimer: INTEL_DISCLAIMER, errorMessage: '',
};

export async function handleChat(input: ChatInput): Promise<ChatOutput> {
  // Validate input
  if (!input.messages || input.messages.length === 0) {
    return { ...ERROR_RESULT, errorMessage: 'At least one message is required' };
  }

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) return { ...ERROR_RESULT, errorMessage: 'Claude API key not configured' };

  // Build initial messages array for Claude
  const messages: any[] = input.messages.map(m => ({
    role: m.role,
    content: m.content,
  }));

  // Add region context if provided
  const systemPrompt = input.region
    ? `${CHAT_SYSTEM_PROMPT}\n\n当前关注区域: ${input.region}`
    : CHAT_SYSTEM_PROMPT;

  const toolsUsed: string[] = [];
  let totalTokens = 0;

  try {
    // Tool-use loop: keep calling Claude until it gives a text response (not tool_use)
    for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(ANTHROPIC_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: SONNET_MODEL,
          max_tokens: 4096,
          system: systemPrompt,
          messages,
          tools: TOOL_DEFINITIONS,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        return { ...ERROR_RESULT, errorMessage: `Claude API error: ${response.status}` };
      }

      const data = await response.json() as any;
      const inputTokens = data.usage?.input_tokens ?? 0;
      const outputTokens = data.usage?.output_tokens ?? 0;
      totalTokens += inputTokens + outputTokens;
      trackUsage(inputTokens, outputTokens, 'sonnet');

      const content = data.content ?? [];
      const stopReason = data.stop_reason;

      // If Claude made tool calls, execute them and continue the loop
      if (stopReason === 'tool_use') {
        // Add Claude's response (with tool_use blocks) to messages
        messages.push({ role: 'assistant', content });

        // Execute each tool call and build tool_result array
        const toolResults: any[] = [];
        for (const block of content) {
          if (block.type === 'tool_use') {
            toolsUsed.push(block.name);
            const result = await executeToolCall(block.name, block.input);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify(result),
            });
          }
        }

        // Add tool results to messages for the next turn
        messages.push({ role: 'user', content: toolResults });
        continue;
      }

      // Claude gave a final text response — extract it
      const textBlocks = content.filter((b: any) => b.type === 'text');
      const reply = textBlocks.map((b: any) => b.text).join('\n');

      return {
        status: 'ok',
        reply,
        toolsUsed: [...new Set(toolsUsed)],
        tokensUsed: totalTokens,
        disclaimer: INTEL_DISCLAIMER,
        errorMessage: '',
      };
    }

    // Exhausted max turns — return whatever we have
    return {
      status: 'ok',
      reply: '分析超过最大步骤数，以下是已获取的信息摘要。请尝试更具体的问题。',
      toolsUsed: [...new Set(toolsUsed)],
      tokensUsed: totalTokens,
      disclaimer: INTEL_DISCLAIMER,
      errorMessage: '',
    };
  } catch (err) {
    return { ...ERROR_RESULT, toolsUsed: [...new Set(toolsUsed)], tokensUsed: totalTokens, errorMessage: err instanceof Error ? err.message : 'Unknown error' };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx tsx --test server/worldmonitor/intel/v1/chat.test.mts`
Expected: PASS (9 tests)

**Step 5: Commit**

```bash
git add server/worldmonitor/intel/v1/chat.ts server/worldmonitor/intel/v1/chat.test.mts
git commit -m "feat(intel): add chat handler with Claude tool-use loop"
```

---

## Task 5: Briefing Handler

**Files:**
- Create: `server/worldmonitor/intel/v1/briefing.ts`
- Create: `server/worldmonitor/intel/v1/briefing.test.mts`

**Step 1: Write the failing test**

Create `server/worldmonitor/intel/v1/briefing.test.mts`:

```typescript
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { handleBriefing } from './briefing.ts';

describe('handleBriefing', () => {
  let mockFetch: ReturnType<typeof mock.fn>;
  const originalFetch = globalThis.fetch;
  const originalEnv = process.env.CLAUDE_API_KEY;

  const makeBriefingResponse = (sections: Array<{ title: string; content: string; sources: string[] }>) => ({
    ok: true,
    json: () => Promise.resolve({
      content: [{ type: 'text', text: JSON.stringify({ sections }) }],
      usage: { input_tokens: 2000, output_tokens: 1500 },
      stop_reason: 'end_turn',
    }),
  });

  beforeEach(() => {
    mockFetch = mock.fn(() => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) }));
    globalThis.fetch = mockFetch as any;
    process.env.CLAUDE_API_KEY = 'test-key';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalEnv !== undefined) process.env.CLAUDE_API_KEY = originalEnv;
    else delete process.env.CLAUDE_API_KEY;
  });

  it('returns structured briefing with sections', async () => {
    const sections = [
      { title: '热点地区动态', content: '中东局势...', sources: ['ACLED', 'GDELT'] },
      { title: '金融市场影响', content: '油价上涨...', sources: ['Finnhub'] },
    ];
    mockFetch.mock.mockImplementationOnce(() => Promise.resolve(makeBriefingResponse(sections)));
    const result = await handleBriefing({ focusRegions: [], language: 'zh' });
    assert.strictEqual(result.status, 'ok');
    assert.ok(result.sections.length > 0, 'Should have sections');
    assert.ok(result.disclaimer.length > 0);
    assert.ok(result.generatedAt > 0);
  });

  it('returns error when API key missing', async () => {
    delete process.env.CLAUDE_API_KEY;
    const result = await handleBriefing({ focusRegions: [], language: 'zh' });
    assert.strictEqual(result.status, 'error');
    assert.ok(result.disclaimer.length > 0);
  });

  it('defaults language to zh', async () => {
    mockFetch.mock.mockImplementationOnce(() => Promise.resolve(makeBriefingResponse([
      { title: 'test', content: 'test', sources: [] },
    ])));
    await handleBriefing({ focusRegions: [], language: '' });
    const body = JSON.parse(mockFetch.mock.calls[0].arguments[1].body);
    assert.ok(body.system.includes('中文'), 'System prompt should be in Chinese');
  });

  it('includes tools in API request', async () => {
    mockFetch.mock.mockImplementationOnce(() => Promise.resolve(makeBriefingResponse([
      { title: 'test', content: 'test', sources: [] },
    ])));
    await handleBriefing({ focusRegions: [], language: 'zh' });
    const body = JSON.parse(mockFetch.mock.calls[0].arguments[1].body);
    assert.ok(Array.isArray(body.tools), 'Should include tools');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx tsx --test server/worldmonitor/intel/v1/briefing.test.mts`
Expected: FAIL

**Step 3: Write implementation**

Create `server/worldmonitor/intel/v1/briefing.ts`:

```typescript
import { TOOL_DEFINITIONS, executeToolCall } from './tools';
import { BRIEFING_SYSTEM_PROMPT, INTEL_DISCLAIMER } from './system-prompts';
import { extractJson } from '../../../../src/utils/ai-response';
import { trackUsage } from '../../claude/v1/spend-tracker';

const SONNET_MODEL = 'claude-sonnet-4-20250514';
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const MAX_TOOL_TURNS = 8; // Briefing may need more tool calls
const TIMEOUT_MS = 90_000; // 90s for briefing

interface BriefingSection {
  title: string;
  content: string;
  sources: string[];
}

interface BriefingInput {
  focusRegions: string[];
  language: string;
}

interface BriefingOutput {
  status: string;
  sections: BriefingSection[];
  generatedAt: number;
  tokensUsed: number;
  disclaimer: string;
  errorMessage: string;
}

const ERROR_RESULT: BriefingOutput = {
  status: 'error', sections: [], generatedAt: 0, tokensUsed: 0,
  disclaimer: INTEL_DISCLAIMER, errorMessage: '',
};

export async function handleBriefing(input: BriefingInput): Promise<BriefingOutput> {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) return { ...ERROR_RESULT, errorMessage: 'Claude API key not configured' };

  const language = input.language || 'zh';
  const systemPrompt = language === 'en'
    ? BRIEFING_SYSTEM_PROMPT.replace(/中文/g, 'English')
    : BRIEFING_SYSTEM_PROMPT;

  const userContent = input.focusRegions.length > 0
    ? `请生成情报简报，重点关注以下区域: ${input.focusRegions.join(', ')}`
    : '请生成今日情报简报，自动判断当前最重要的热点。';

  const messages: any[] = [{ role: 'user', content: userContent }];
  const toolsUsed: string[] = [];
  let totalTokens = 0;

  try {
    for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(ANTHROPIC_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: SONNET_MODEL,
          max_tokens: 8192,
          system: systemPrompt,
          messages,
          tools: TOOL_DEFINITIONS,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        return { ...ERROR_RESULT, errorMessage: `Claude API error: ${response.status}` };
      }

      const data = await response.json() as any;
      const inputTokens = data.usage?.input_tokens ?? 0;
      const outputTokens = data.usage?.output_tokens ?? 0;
      totalTokens += inputTokens + outputTokens;
      trackUsage(inputTokens, outputTokens, 'sonnet');

      const content = data.content ?? [];
      const stopReason = data.stop_reason;

      if (stopReason === 'tool_use') {
        messages.push({ role: 'assistant', content });
        const toolResults: any[] = [];
        for (const block of content) {
          if (block.type === 'tool_use') {
            toolsUsed.push(block.name);
            const result = await executeToolCall(block.name, block.input);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify(result),
            });
          }
        }
        messages.push({ role: 'user', content: toolResults });
        continue;
      }

      // Final text response — try to parse as structured sections
      const textBlocks = content.filter((b: any) => b.type === 'text');
      const fullText = textBlocks.map((b: any) => b.text).join('\n');

      let sections: BriefingSection[];
      try {
        const parsed = extractJson<{ sections: BriefingSection[] }>(fullText);
        sections = parsed.sections ?? [];
      } catch {
        // Claude returned markdown instead of JSON — wrap as single section
        sections = [{ title: '情报简报', content: fullText, sources: [...new Set(toolsUsed)] }];
      }

      return {
        status: 'ok',
        sections,
        generatedAt: Date.now(),
        tokensUsed: totalTokens,
        disclaimer: INTEL_DISCLAIMER,
        errorMessage: '',
      };
    }

    return { ...ERROR_RESULT, errorMessage: 'Briefing generation exceeded maximum steps' };
  } catch (err) {
    return { ...ERROR_RESULT, errorMessage: err instanceof Error ? err.message : 'Unknown error' };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx tsx --test server/worldmonitor/intel/v1/briefing.test.mts`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add server/worldmonitor/intel/v1/briefing.ts server/worldmonitor/intel/v1/briefing.test.mts
git commit -m "feat(intel): add briefing handler with structured output"
```

---

## Task 6: Service Handler + Edge Function

**Files:**
- Create: `server/worldmonitor/intel/v1/handler.ts`
- Create: `api/intel/v1/[rpc].ts`
- Modify: `server/sentinel-cache-tiers.ts`

**Step 1: Create handler.ts**

```typescript
import type { IntelServiceHandler, ServerContext, ChatRequest, BriefingRequest } from '../../../../src/generated/server/worldmonitor/intel/v1/service_server';
import { handleChat } from './chat';
import { handleBriefing } from './briefing';

export const intelHandler: IntelServiceHandler = {
  chat: (_ctx: ServerContext, req: ChatRequest) => handleChat(req),
  briefing: (_ctx: ServerContext, req: BriefingRequest) => handleBriefing(req),
};
```

**Step 2: Create Edge Function `api/intel/v1/[rpc].ts`**

```typescript
export const config = { runtime: 'edge' };

import { createDomainGateway, serverOptions } from '../../../server/gateway';
import { createIntelServiceRoutes } from '../../../src/generated/server/worldmonitor/intel/v1/service_server';
import { intelHandler } from '../../../server/worldmonitor/intel/v1/handler';
import { checkKillswitch } from '../../../server/_shared/killswitch';
import { isBudgetExceeded } from '../../../server/worldmonitor/claude/v1/spend-tracker';

const routes = createIntelServiceRoutes(intelHandler, serverOptions);
const gateway = createDomainGateway(routes);

export default async function handler(req: Request): Promise<Response> {
  const disabled = checkKillswitch('INTEL');
  if (disabled) return disabled;

  if (isBudgetExceeded()) {
    return new Response(
      JSON.stringify({ error: 'Daily Claude budget exceeded', status: 'budget_exceeded' }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '3600' } },
    );
  }

  return gateway(req);
}
```

**Step 3: Add cache tier entries to `server/sentinel-cache-tiers.ts`**

Add these two lines to the `SENTINEL_CACHE_TIERS` object:

```typescript
  '/api/intel/v1/chat': 'no-store',       // Chat responses are unique per conversation
  '/api/intel/v1/briefing': 'slow',        // Briefings can be cached 30min
```

**Step 4: Commit**

```bash
git add server/worldmonitor/intel/v1/handler.ts api/intel/v1/[rpc].ts server/sentinel-cache-tiers.ts
git commit -m "feat(intel): add service handler and edge function"
```

---

## Task 7: Registration (Feature Flags, Panel Config, i18n)

**Files:**
- Modify: `src/services/runtime-config.ts:42-71` — add `intelChat` to `RuntimeFeatureId` union
- Modify: `src/services/runtime-config.ts:104-138` — add `intelChat: true` to default toggles
- Modify: `src/config/sentinel-panels.ts` — add `intel-chat` panel
- Modify: `src/locales/sentinel-en.json` — add i18n keys

**Step 1: Add RuntimeFeatureId**

In `src/services/runtime-config.ts`, after line ~71 (`| 'predictionMetaculus'`), add:

```typescript
  | 'intelChat'       // SENTINEL: Intelligence Chat
```

In the `defaultToggles` object (around line 137), before the `// SENTINEL: end` comment, add:

```typescript
  intelChat: true,
```

**Step 2: Add panel config**

In `src/config/sentinel-panels.ts`, add to the `SENTINEL_PANELS` object:

```typescript
  'intel-chat': { name: 'Intelligence Chat', enabled: true, priority: 0 },
```

Priority 0 = appears first.

**Step 3: Add i18n keys**

In `src/locales/sentinel-en.json`, add to the `sentinel` object:

```json
    "intel": {
      "title": "Intelligence Chat",
      "placeholder": "Ask about geopolitics, markets, safety...",
      "send": "Send",
      "briefing": "Generate Briefing",
      "generating": "Analyzing...",
      "error": "Failed to get response. Check your Claude API key.",
      "welcome": "Hello! I'm your Omni Sentinel intelligence analyst. Ask me about current geopolitical events, financial markets, or travel safety.",
      "disclaimer": "AI-generated analysis based on public data. Not a sole basis for decisions.",
      "toolsUsed": "Sources",
      "briefingTitle": "Intelligence Briefing",
      "briefingGenerating": "Generating briefing...",
      "briefingEmpty": "No briefing data available"
    }
```

**Step 4: Commit**

```bash
git add src/services/runtime-config.ts src/config/sentinel-panels.ts src/locales/sentinel-en.json
git commit -m "feat(intel): register feature flag, panel config, and i18n keys"
```

---

## Task 8: Client Wrapper

**Files:**
- Create: `src/services/intel/index.ts`

**Step 1: Create client wrapper**

```typescript
import { IntelServiceClient } from '../../generated/client/worldmonitor/intel/v1/service_client';
import type { ChatResponse, BriefingResponse } from '../../generated/client/worldmonitor/intel/v1/service_client';

const client = new IntelServiceClient('', { fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args) });

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function sendChatMessage(
  messages: ChatMessage[],
  region = '',
): Promise<ChatResponse> {
  return client.chat({ messages, region });
}

export async function generateBriefing(
  focusRegions: string[] = [],
  language = 'zh',
): Promise<BriefingResponse> {
  return client.briefing({ focusRegions, language });
}
```

**Step 2: Commit**

```bash
git add src/services/intel/index.ts
git commit -m "feat(intel): add client wrapper for chat and briefing"
```

---

## Task 9: IntelChatPanel UI

The main UI component — a chat panel embedded in the map.

**Files:**
- Create: `src/components/IntelChatPanel.ts`

**Step 1: Create the panel**

```typescript
/**
 * IntelChatPanel — Conversational AI intelligence panel.
 *
 * Extends Panel base class with vanilla DOM (h() helper, NOT JSX).
 * Features: multi-turn chat, briefing generation, tools-used badges.
 * Messages rendered as textContent (never innerHTML) for XSS safety.
 * Claude responses with markdown sanitized via DOMPurify.
 */

import { Panel } from './Panel';
import { t } from '@/services/i18n';
import { h, replaceChildren } from '@/utils/dom-utils';
import { createErrorDisplay } from './sentinel/error-display';
import { createDataFreshnessIndicator, type FreshnessStatus } from './sentinel/DataFreshnessIndicator';
import { sendChatMessage, generateBriefing, type ChatMessage } from '@/services/intel';
import DOMPurify from 'dompurify';

interface DisplayMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolsUsed?: string[];
  timestamp: number;
}

const MAX_HISTORY = 50; // Max messages in session
const INPUT_MAX_LENGTH = 2000;

export class IntelChatPanel extends Panel {
  private chatMessages: DisplayMessage[] = [];
  private apiMessages: ChatMessage[] = [];
  private messagesEl: HTMLElement;
  private inputEl: HTMLTextAreaElement;
  private sendBtn: HTMLButtonElement;
  private briefingBtn: HTMLButtonElement;
  private freshnessEl: HTMLElement | null = null;
  private isLoading = false;

  constructor() {
    super({
      id: 'intel-chat',
      title: t('sentinel.intel.title'),
      className: 'panel-wide',
    });

    this.messagesEl = h('div', { className: 'intel-chat-messages' });
    this.inputEl = h('textarea', {
      className: 'intel-chat-input',
      placeholder: t('sentinel.intel.placeholder'),
      maxLength: INPUT_MAX_LENGTH,
      rows: 2,
    }) as HTMLTextAreaElement;

    this.sendBtn = h('button', {
      className: 'intel-chat-send',
      onClick: () => this.handleSend(),
    }, t('sentinel.intel.send')) as HTMLButtonElement;

    this.briefingBtn = h('button', {
      className: 'intel-chat-briefing',
      onClick: () => this.handleBriefing(),
    }, t('sentinel.intel.briefing')) as HTMLButtonElement;

    // Enter to send (Shift+Enter for newline)
    this.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });

    const inputRow = h('div', { className: 'intel-chat-input-row' },
      this.inputEl,
      h('div', { className: 'intel-chat-buttons' },
        this.sendBtn,
        this.briefingBtn,
      ),
    );

    const container = h('div', { className: 'intel-chat-container' },
      this.messagesEl,
      inputRow,
    );

    replaceChildren(this.content, container);
    this.injectStyles();

    // Welcome message
    this.addMessage({
      role: 'system',
      content: t('sentinel.intel.welcome'),
      timestamp: Date.now(),
    });
  }

  private async handleSend(): Promise<void> {
    const text = this.inputEl.value.trim();
    if (!text || this.isLoading) return;

    this.inputEl.value = '';
    this.addMessage({ role: 'user', content: text, timestamp: Date.now() });
    this.apiMessages.push({ role: 'user', content: text });

    this.setLoading(true);
    this.updateFreshness('loading');

    try {
      const resp = await sendChatMessage(this.apiMessages);
      if (resp.status === 'error') {
        this.addMessage({
          role: 'assistant',
          content: resp.errorMessage || t('sentinel.intel.error'),
          timestamp: Date.now(),
        });
        this.updateFreshness('unavailable');
        return;
      }

      this.apiMessages.push({ role: 'assistant', content: resp.reply });
      this.addMessage({
        role: 'assistant',
        content: resp.reply,
        toolsUsed: resp.toolsUsed,
        timestamp: Date.now(),
      });
      this.updateFreshness('live');
    } catch (err) {
      this.addMessage({
        role: 'assistant',
        content: err instanceof Error ? err.message : t('sentinel.intel.error'),
        timestamp: Date.now(),
      });
      this.updateFreshness('unavailable');
    } finally {
      this.setLoading(false);
    }
  }

  private async handleBriefing(): Promise<void> {
    if (this.isLoading) return;

    this.addMessage({
      role: 'user',
      content: t('sentinel.intel.briefing'),
      timestamp: Date.now(),
    });

    this.setLoading(true);
    this.updateFreshness('loading');

    try {
      const resp = await generateBriefing();
      if (resp.status === 'error') {
        this.addMessage({
          role: 'assistant',
          content: resp.errorMessage || t('sentinel.intel.error'),
          timestamp: Date.now(),
        });
        this.updateFreshness('unavailable');
        return;
      }

      const briefingContent = resp.sections
        .map(s => `### ${s.title}\n\n${s.content}\n\n*${t('sentinel.intel.toolsUsed')}: ${s.sources.join(', ')}*`)
        .join('\n\n---\n\n');

      this.addMessage({
        role: 'assistant',
        content: briefingContent || t('sentinel.intel.briefingEmpty'),
        timestamp: Date.now(),
      });
      this.updateFreshness('live');
    } catch (err) {
      this.addMessage({
        role: 'assistant',
        content: err instanceof Error ? err.message : t('sentinel.intel.error'),
        timestamp: Date.now(),
      });
      this.updateFreshness('unavailable');
    } finally {
      this.setLoading(false);
    }
  }

  private addMessage(msg: DisplayMessage): void {
    this.chatMessages.push(msg);
    if (this.chatMessages.length > MAX_HISTORY) {
      this.chatMessages.shift();
    }
    this.renderMessage(msg);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  private renderMessage(msg: DisplayMessage): void {
    const roleClass = `intel-chat-msg intel-chat-msg--${msg.role}`;

    const bubble = h('div', { className: roleClass });

    if (msg.role === 'assistant') {
      // Sanitize markdown for assistant responses
      const sanitized = DOMPurify.sanitize(msg.content, { ALLOWED_TAGS: [], KEEP_CONTENT: true });
      bubble.textContent = sanitized;
    } else {
      bubble.textContent = msg.content;
    }

    if (msg.toolsUsed && msg.toolsUsed.length > 0) {
      const badges = h('div', { className: 'intel-chat-tools' },
        ...msg.toolsUsed.map(tool =>
          h('span', { className: 'intel-chat-tool-badge' }, tool),
        ),
      );
      bubble.appendChild(badges);
    }

    this.messagesEl.appendChild(bubble);
  }

  private setLoading(loading: boolean): void {
    this.isLoading = loading;
    this.sendBtn.disabled = loading;
    this.briefingBtn.disabled = loading;
    this.inputEl.disabled = loading;

    if (loading) {
      const loader = h('div', {
        className: 'intel-chat-msg intel-chat-msg--loading',
        id: 'intel-loading',
      }, t('sentinel.intel.generating'));
      this.messagesEl.appendChild(loader);
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    } else {
      const loader = this.messagesEl.querySelector('#intel-loading');
      if (loader) loader.remove();
    }
  }

  private updateFreshness(status: FreshnessStatus): void {
    if (this.freshnessEl) this.freshnessEl.remove();
    this.freshnessEl = createDataFreshnessIndicator(status, null);
    this.element.insertBefore(this.freshnessEl, this.header.nextSibling);
  }

  private injectStyles(): void {
    if (document.getElementById('intel-chat-styles')) return;

    const style = document.createElement('style');
    style.id = 'intel-chat-styles';
    style.textContent = `
      .intel-chat-container { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
      .intel-chat-messages { flex: 1; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 8px; }
      .intel-chat-msg { padding: 8px 12px; border-radius: 8px; max-width: 90%; font-size: 0.9em; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
      .intel-chat-msg--user { align-self: flex-end; background: var(--accent-color, #3b82f6); color: white; }
      .intel-chat-msg--assistant { align-self: flex-start; background: var(--bg-secondary, #2a2a2a); color: var(--text-primary, #ddd); }
      .intel-chat-msg--system { align-self: center; background: transparent; color: var(--text-secondary, #888); font-style: italic; text-align: center; font-size: 0.85em; }
      .intel-chat-msg--loading { align-self: center; color: var(--text-secondary, #888); font-style: italic; animation: pulse 1.5s infinite; }
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      .intel-chat-tools { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
      .intel-chat-tool-badge { font-size: 0.7em; padding: 2px 6px; background: var(--accent-color, #3b82f6)20; color: var(--accent-color, #3b82f6); border-radius: 4px; }
      .intel-chat-input-row { display: flex; gap: 8px; padding: 8px; border-top: 1px solid var(--border-color, #444); align-items: flex-end; }
      .intel-chat-input { flex: 1; padding: 8px; background: var(--bg-secondary, #2a2a2a); border: 1px solid var(--border-color, #444); color: var(--text-primary, #fff); border-radius: 6px; font-family: inherit; resize: none; font-size: 0.9em; }
      .intel-chat-buttons { display: flex; flex-direction: column; gap: 4px; }
      .intel-chat-send, .intel-chat-briefing { padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8em; white-space: nowrap; }
      .intel-chat-send { background: var(--accent-color, #3b82f6); color: white; }
      .intel-chat-send:hover { background: var(--accent-hover, #2563eb); }
      .intel-chat-briefing { background: var(--bg-secondary, #2a2a2a); color: var(--text-primary, #ddd); border: 1px solid var(--border-color, #444); }
      .intel-chat-briefing:hover { background: var(--border-color, #444); }
      .intel-chat-send:disabled, .intel-chat-briefing:disabled { opacity: 0.5; cursor: not-allowed; }
    `;
    document.head.appendChild(style);
  }

  public showError(message = t('sentinel.intel.error')): void {
    try {
      createErrorDisplay('IntelChat', this.content, new Error(message));
    } catch {
      super.showError(message);
    }
  }

  public destroy(): void {
    if (this.freshnessEl) {
      this.freshnessEl.remove();
      this.freshnessEl = null;
    }
    this.chatMessages = [];
    this.apiMessages = [];
    super.destroy();
  }
}
```

**Step 2: Commit**

```bash
git add src/components/IntelChatPanel.ts
git commit -m "feat(intel): add IntelChatPanel with chat UI and briefing button"
```

---

## Task 10: Typecheck + Full Test Run

**Step 1: Run API typecheck**

Run: `npx tsc --noEmit -p tsconfig.api.json`
Expected: PASS (0 errors)

If there are errors, fix them (likely import paths or missing generated types).

**Step 2: Run frontend typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Run all tests**

Run: `npx tsx --test 'server/**/*.test.mts'`
Expected: All tests pass (existing + new intel tests)

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(intel): resolve typecheck and test issues"
```

---

## Task 11: Push and Verify

**Step 1: Push to remote**

Run: `git push origin main`

**Step 2: Verify feature flag**

Confirm `MODULE_INTEL_ENABLED` is not explicitly set to `false` (default = enabled).

**Step 3: Run locally**

Run: `npm run dev`
Expected: App loads, IntelChatPanel appears in left sidebar. Typing a question and pressing Send calls `/api/intel/v1/chat`. "Generate Briefing" button calls `/api/intel/v1/briefing`.

---

## Summary

| Task | What | Files | Tests |
|------|------|-------|-------|
| 1 | Proto definitions | 3 proto + generated | — |
| 2 | System prompts | 1 source + 1 test | 3 |
| 3 | Tool registry (~45 tools) | 1 source + 1 test | 5 |
| 4 | Chat handler | 1 source + 1 test | 9 |
| 5 | Briefing handler | 1 source + 1 test | 4 |
| 6 | Handler + Edge Function | 3 files | — |
| 7 | Feature flags + i18n | 3 files | — |
| 8 | Client wrapper | 1 file | — |
| 9 | Chat Panel UI | 1 file | — |
| 10 | Typecheck + full test | — | all |
| 11 | Push + verify | — | — |

**Total: ~12 new files, ~21 new tests, ~45 tool registrations**
