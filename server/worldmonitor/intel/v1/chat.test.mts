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
    assert.ok(result.reply.includes('测试回复'));
    assert.ok(result.disclaimer.length > 0);
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
    assert.ok(result.errorMessage.toLowerCase().includes('message'));
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
    assert.ok(Array.isArray(body.tools));
    assert.ok(body.tools.length > 20, `Should have many tools, got ${body.tools.length}`);
  });

  it('uses Sonnet model', async () => {
    mockFetch.mock.mockImplementationOnce(() => Promise.resolve(makeApiResponse('ok')));
    await handleChat({ messages: [{ role: 'user', content: 'test' }], region: '' });
    const body = JSON.parse(mockFetch.mock.calls[0].arguments[1].body);
    assert.ok(body.model.includes('sonnet'), `Expected sonnet, got: ${body.model}`);
  });

  it('enforces maximum turns to prevent infinite loops', async () => {
    mockFetch.mock.mockImplementation(() =>
      Promise.resolve(makeToolUseResponse([{ id: 'call_1', name: 'nonexistent_tool', input: {} }])),
    );
    const result = await handleChat({ messages: [{ role: 'user', content: 'test' }], region: '' });
    assert.ok(result.status === 'ok' || result.status === 'error');
    assert.ok(mockFetch.mock.calls.length <= 10, 'Should not exceed max turns');
  });
});
