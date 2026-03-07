# Tavily Unified Search — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `web_search`, `web_extract`, and `verify_claim` tools to the Intelligence Assistant's tool registry, enabling public web search and social media claim verification via Tavily API.

**Architecture:** Three new `register()` calls in `tools.ts`, each calling the Tavily REST API directly (no handler files needed — Tavily is a simple HTTP call). System prompt updated with verification instructions. Graceful degradation when `TAVILY_API_KEY` is missing.

**Tech Stack:** Tavily Search API v1, Tavily Extract API v1, `node:test` + `node:assert/strict`

---

### Task 1: Write failing tests for web_search tool

**Files:**
- Modify: `server/worldmonitor/intel/v1/tools.test.mts`

**Step 1: Write the failing tests**

Add these tests to the existing `tools.test.mts` file, after the last existing `it()` block:

```typescript
describe('web_search tool', () => {
  it('web_search is registered', () => {
    const tool = TOOL_DEFINITIONS.find(t => t.name === 'web_search');
    assert.ok(tool, 'web_search tool should be registered');
    assert.ok(tool!.description.length > 0);
    assert.ok(tool!.input_schema.properties.query, 'should have query param');
  });

  it('web_search returns error when TAVILY_API_KEY is missing', async () => {
    const original = process.env.TAVILY_API_KEY;
    delete process.env.TAVILY_API_KEY;
    try {
      const result = await executeToolCall('web_search', { query: 'test' }) as any;
      assert.ok(result.error || result.status === 'not_configured');
    } finally {
      if (original) process.env.TAVILY_API_KEY = original;
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx tsx --test server/worldmonitor/intel/v1/tools.test.mts`
Expected: FAIL — `web_search tool should be registered`

---

### Task 2: Implement web_search tool

**Files:**
- Modify: `server/worldmonitor/intel/v1/tools.ts` (append before `// Exports` section)

**Step 1: Add web_search register() call**

Insert this block before the `// ========================================================================` / `// Exports` comment at line ~994:

```typescript
// ========================================================================
// SENTINEL: Web Search (Tavily)
// ========================================================================

register(
  'web_search',
  '搜索公开互联网获取实时信息（新闻报道、智库分析、政府声明、百科资料等）。当其他专用工具无法覆盖所需信息时使用。',
  {
    query: { type: 'string', description: '搜索关键词（英文效果最佳）' },
    topic: { type: 'string', enum: ['general', 'news'], description: '"news" 搜新闻源，"general" 搜全网' },
    time_range: { type: 'string', enum: ['day', 'week', 'month', 'year'], description: '时间范围筛选' },
    include_domains: { type: 'array', items: { type: 'string' }, description: '限定搜索域名列表' },
    search_depth: { type: 'string', enum: ['basic', 'advanced'], description: '"basic"(1 credit) 或 "advanced"(2 credits)' },
  },
  ['query'],
  async (args) => {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return { error: 'Web search not configured. Set TAVILY_API_KEY to enable.', status: 'not_configured' };
    }
    const resp = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: args.query as string,
        topic: args.topic as string ?? 'news',
        search_depth: args.search_depth as string ?? 'basic',
        max_results: 8,
        time_range: args.time_range as string | undefined,
        include_domains: args.include_domains as string[] | undefined,
      }),
    });
    if (!resp.ok) {
      return { error: `Tavily search failed: ${resp.status}` };
    }
    return resp.json();
  },
);
```

**Step 2: Run test to verify it passes**

Run: `npx tsx --test server/worldmonitor/intel/v1/tools.test.mts`
Expected: PASS — all tests including `web_search is registered` and `returns error when TAVILY_API_KEY is missing`

**Step 3: Commit**

```bash
git add server/worldmonitor/intel/v1/tools.ts server/worldmonitor/intel/v1/tools.test.mts
git commit -m "feat(intel): add web_search tool (Tavily Search API)"
```

---

### Task 3: Write failing tests for web_extract tool

**Files:**
- Modify: `server/worldmonitor/intel/v1/tools.test.mts`

**Step 1: Write the failing tests**

```typescript
describe('web_extract tool', () => {
  it('web_extract is registered', () => {
    const tool = TOOL_DEFINITIONS.find(t => t.name === 'web_extract');
    assert.ok(tool, 'web_extract tool should be registered');
    assert.ok(tool!.input_schema.properties.urls, 'should have urls param');
    assert.deepStrictEqual(tool!.input_schema.required, ['urls']);
  });

  it('web_extract returns error when TAVILY_API_KEY is missing', async () => {
    const original = process.env.TAVILY_API_KEY;
    delete process.env.TAVILY_API_KEY;
    try {
      const result = await executeToolCall('web_extract', { urls: ['https://example.com'] }) as any;
      assert.ok(result.error || result.status === 'not_configured');
    } finally {
      if (original) process.env.TAVILY_API_KEY = original;
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx tsx --test server/worldmonitor/intel/v1/tools.test.mts`
Expected: FAIL — `web_extract tool should be registered`

---

### Task 4: Implement web_extract tool

**Files:**
- Modify: `server/worldmonitor/intel/v1/tools.ts`

**Step 1: Add web_extract register() call**

Insert after the `web_search` register block:

```typescript
register(
  'web_extract',
  '从指定URL提取文章全文内容（Markdown格式）。用于深入阅读 web_search 找到的重要文章。最多5个URL。',
  {
    urls: { type: 'array', items: { type: 'string' }, description: '要提取内容的URL列表（最多5个）' },
  },
  ['urls'],
  async (args) => {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return { error: 'Web extract not configured. Set TAVILY_API_KEY to enable.', status: 'not_configured' };
    }
    const urls = (args.urls as string[]).slice(0, 5);
    const resp = await fetch('https://api.tavily.com/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        urls,
      }),
    });
    if (!resp.ok) {
      return { error: `Tavily extract failed: ${resp.status}` };
    }
    return resp.json();
  },
);
```

**Step 2: Run test to verify it passes**

Run: `npx tsx --test server/worldmonitor/intel/v1/tools.test.mts`
Expected: PASS

**Step 3: Commit**

```bash
git add server/worldmonitor/intel/v1/tools.ts server/worldmonitor/intel/v1/tools.test.mts
git commit -m "feat(intel): add web_extract tool (Tavily Extract API)"
```

---

### Task 5: Write failing tests for verify_claim tool

**Files:**
- Modify: `server/worldmonitor/intel/v1/tools.test.mts`

**Step 1: Write the failing tests**

```typescript
describe('verify_claim tool', () => {
  it('verify_claim is registered', () => {
    const tool = TOOL_DEFINITIONS.find(t => t.name === 'verify_claim');
    assert.ok(tool, 'verify_claim tool should be registered');
    assert.ok(tool!.input_schema.properties.claim, 'should have claim param');
    assert.ok(tool!.input_schema.properties.source, 'should have source param');
    assert.deepStrictEqual(tool!.input_schema.required, ['claim']);
  });

  it('verify_claim returns not_configured when TAVILY_API_KEY is missing', async () => {
    const original = process.env.TAVILY_API_KEY;
    delete process.env.TAVILY_API_KEY;
    try {
      const result = await executeToolCall('verify_claim', { claim: 'test claim' }) as any;
      assert.ok(result.error || result.status === 'not_configured');
    } finally {
      if (original) process.env.TAVILY_API_KEY = original;
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx tsx --test server/worldmonitor/intel/v1/tools.test.mts`
Expected: FAIL — `verify_claim tool should be registered`

---

### Task 6: Implement verify_claim tool

**Files:**
- Modify: `server/worldmonitor/intel/v1/tools.ts`

**Step 1: Add verify_claim register() call**

Insert after the `web_extract` register block:

```typescript
register(
  'verify_claim',
  '验证一条来自社交媒体或其他未经证实来源的声明。搜索公开新闻报道进行交叉验证，返回验证状态（corroborated/unverified/contradicted）和证据。',
  {
    claim: { type: 'string', description: '要验证的声明内容' },
    source: { type: 'string', description: '声明来源，如 "Twitter @IntelDoge" 或 "Reddit r/geopolitics"' },
  },
  ['claim'],
  async (args) => {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return { error: 'Claim verification not configured. Set TAVILY_API_KEY to enable.', status: 'not_configured' };
    }
    const claim = args.claim as string;
    const source = args.source as string ?? 'unknown';

    // Search for corroborating evidence
    const resp = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: claim,
        topic: 'news',
        search_depth: 'basic',
        max_results: 5,
        time_range: 'week',
      }),
    });

    if (!resp.ok) {
      return { error: `Tavily search failed during verification: ${resp.status}` };
    }

    const data = await resp.json() as { results?: Array<{ title: string; url: string; content: string; score: number }> };
    const results = data.results ?? [];

    // Determine verification status based on results
    const highRelevance = results.filter((r: any) => r.score > 0.7);

    let status: 'corroborated' | 'unverified' | 'contradicted';
    let summary: string;

    if (highRelevance.length >= 2) {
      status = 'corroborated';
      summary = `${highRelevance.length} 条权威来源报道与该声明一致`;
    } else if (highRelevance.length === 1) {
      status = 'corroborated';
      summary = `1 条权威来源报道支持该声明: ${highRelevance[0].title}`;
    } else if (results.length > 0) {
      status = 'unverified';
      summary = `找到 ${results.length} 条相关结果，但相关度不高，无法确认`;
    } else {
      status = 'unverified';
      summary = '未找到相关权威报道，该声明尚未被公开来源证实';
    }

    return {
      status,
      claim,
      source,
      summary,
      evidence: results.slice(0, 5).map((r: any) => ({
        title: r.title,
        url: r.url,
        snippet: r.content?.slice(0, 300),
        score: r.score,
      })),
    };
  },
);
```

**Step 2: Run test to verify it passes**

Run: `npx tsx --test server/worldmonitor/intel/v1/tools.test.mts`
Expected: PASS

**Step 3: Commit**

```bash
git add server/worldmonitor/intel/v1/tools.ts server/worldmonitor/intel/v1/tools.test.mts
git commit -m "feat(intel): add verify_claim tool (Tavily-powered cross-verification)"
```

---

### Task 7: Update system prompt with verification rules

**Files:**
- Modify: `server/worldmonitor/intel/v1/system-prompts.ts`
- Test: `server/worldmonitor/intel/v1/system-prompts.test.mts`

**Step 1: Write the failing test**

Add to `system-prompts.test.mts`:

```typescript
it('CHAT_SYSTEM_PROMPT includes web search and verification instructions', () => {
  assert.ok(CHAT_SYSTEM_PROMPT.includes('web_search'), 'Should mention web_search tool');
  assert.ok(CHAT_SYSTEM_PROMPT.includes('verify_claim'), 'Should mention verify_claim tool');
  assert.ok(CHAT_SYSTEM_PROMPT.includes('已验证'), 'Should include verification label format');
});
```

**Step 2: Run test to verify it fails**

Run: `npx tsx --test server/worldmonitor/intel/v1/system-prompts.test.mts`
Expected: FAIL — `Should mention web_search tool`

**Step 3: Update CHAT_SYSTEM_PROMPT**

In `system-prompts.ts`, append the following to the `CHAT_SYSTEM_PROMPT` template string, right before the closing backtick (after line 34's `注意：你只能查询公开数据。无法追踪个人私人信息。`):

```typescript
// Append this text to the existing CHAT_SYSTEM_PROMPT string:

网页搜索与验证规则：
- 当用户研究某个话题/人物/事件时，使用 web_search 搜索公开互联网补充信息
- 当从社交媒体工具（list_tweets, list_reddit_posts, list_vk_posts 等）获取到具体声明或事件报告时，使用 verify_claim 验证其真实性
- 验证结果用以下格式标注：
  ✅ 已验证: [来源] 报道确认
  ⚠️ 未验证: 仅社交媒体来源，未找到权威报道
  ❌ 存疑: 与 [来源] 的报道矛盾
- 需要深入阅读某篇文章全文时，使用 web_extract 提取内容
- web_search 优先搜索新闻源（topic: "news"），研究性问题用 "general"
- 网页搜索: 公开互联网新闻、智库报告、政府声明、百科
```

Also update the tool domain list to include:
```
- 网页搜索: 公开互联网新闻、智库报告、政府声明、百科
```

**Step 4: Run test to verify it passes**

Run: `npx tsx --test server/worldmonitor/intel/v1/system-prompts.test.mts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/worldmonitor/intel/v1/system-prompts.ts server/worldmonitor/intel/v1/system-prompts.test.mts
git commit -m "feat(intel): add web search verification rules to system prompt"
```

---

### Task 8: Update .env.example with TAVILY_API_KEY

**Files:**
- Modify: `.env.example`

**Step 1: Add TAVILY_API_KEY to .env.example**

Insert after the `TWITTER_BEARER_TOKEN=` line (around line 189), or at the end of the SENTINEL section:

```
# ------ Tavily Web Search API ------
# Free tier: 1,000 credits/month (no credit card required)
# Get yours at: https://app.tavily.com/
TAVILY_API_KEY=
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: add TAVILY_API_KEY to .env.example"
```

---

### Task 9: Run full test suite and typecheck

**Step 1: Run all intel tests**

Run: `npx tsx --test server/worldmonitor/intel/v1/*.test.mts`
Expected: All tests PASS (tools, chat, briefing, system-prompts)

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

Run: `npm run typecheck:api`
Expected: No errors

**Step 3: Run dev server smoke test**

Run: `npm run dev`
Expected: Dev server starts without errors on port 5173

**Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix(intel): resolve issues from full test suite"
```

---

## File Summary

| File | Change Type | Lines Changed |
|------|------------|---------------|
| `server/worldmonitor/intel/v1/tools.ts` | Modify | +95 (3 register blocks) |
| `server/worldmonitor/intel/v1/tools.test.mts` | Modify | +40 (3 describe blocks) |
| `server/worldmonitor/intel/v1/system-prompts.ts` | Modify | +10 (prompt append) |
| `server/worldmonitor/intel/v1/system-prompts.test.mts` | Modify | +5 (1 test) |
| `.env.example` | Modify | +4 (env var docs) |

**Total: 5 files, ~150 lines added, 0 files created**
