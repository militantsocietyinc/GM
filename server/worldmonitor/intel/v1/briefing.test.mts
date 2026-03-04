import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { handleBriefing } from './briefing.ts';

describe('handleBriefing', () => {
  let mockFetch: ReturnType<typeof mock.fn>;
  const originalFetch = globalThis.fetch;
  const originalEnv = process.env.CLAUDE_API_KEY;

  const makeBriefingResponse = (text: string, usage = { input_tokens: 2000, output_tokens: 1500 }) => ({
    ok: true,
    json: () => Promise.resolve({
      content: [{ type: 'text', text }],
      usage,
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

  it('returns structured briefing with sections from JSON', async () => {
    const json = JSON.stringify({
      sections: [
        { title: '热点地区动态', content: '中东局势紧张...', sources: ['ACLED', 'GDELT'] },
        { title: '金融市场影响', content: '油价上涨...', sources: ['Finnhub'] },
      ],
    });
    mockFetch.mock.mockImplementationOnce(() => Promise.resolve(makeBriefingResponse(json)));
    const result = await handleBriefing({ focusRegions: [], language: 'zh' });
    assert.strictEqual(result.status, 'ok');
    assert.strictEqual(result.sections.length, 2);
    assert.strictEqual(result.sections[0].title, '热点地区动态');
    assert.ok(result.disclaimer.length > 0);
    assert.ok(result.generatedAt > 0);
  });

  it('wraps plain text response as single section', async () => {
    mockFetch.mock.mockImplementationOnce(() => Promise.resolve(makeBriefingResponse('This is a plain text briefing without JSON structure.')));
    const result = await handleBriefing({ focusRegions: [], language: 'zh' });
    assert.strictEqual(result.status, 'ok');
    assert.strictEqual(result.sections.length, 1);
    assert.ok(result.sections[0].content.includes('plain text'));
  });

  it('returns error when API key missing', async () => {
    delete process.env.CLAUDE_API_KEY;
    const result = await handleBriefing({ focusRegions: [], language: 'zh' });
    assert.strictEqual(result.status, 'error');
    assert.ok(result.disclaimer.length > 0);
  });

  it('defaults language to zh', async () => {
    const json = JSON.stringify({ sections: [{ title: 'test', content: 'test', sources: [] }] });
    mockFetch.mock.mockImplementationOnce(() => Promise.resolve(makeBriefingResponse(json)));
    await handleBriefing({ focusRegions: [], language: '' });
    const body = JSON.parse(mockFetch.mock.calls[0].arguments[1].body);
    assert.ok(body.system.includes('中文'));
  });

  it('includes tools in API request', async () => {
    const json = JSON.stringify({ sections: [{ title: 'test', content: 'test', sources: [] }] });
    mockFetch.mock.mockImplementationOnce(() => Promise.resolve(makeBriefingResponse(json)));
    await handleBriefing({ focusRegions: [], language: 'zh' });
    const body = JSON.parse(mockFetch.mock.calls[0].arguments[1].body);
    assert.ok(Array.isArray(body.tools));
  });

  it('uses higher max_tokens than chat', async () => {
    const json = JSON.stringify({ sections: [{ title: 'test', content: 'test', sources: [] }] });
    mockFetch.mock.mockImplementationOnce(() => Promise.resolve(makeBriefingResponse(json)));
    await handleBriefing({ focusRegions: [], language: 'zh' });
    const body = JSON.parse(mockFetch.mock.calls[0].arguments[1].body);
    assert.ok(body.max_tokens >= 8192, `Briefing should have high max_tokens, got ${body.max_tokens}`);
  });
});
