import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { handleAssessment } from './assessment.ts';

describe('handleAssessment', () => {
  let mockFetch: ReturnType<typeof mock.fn>;
  const originalFetch = globalThis.fetch;
  const originalEnv = process.env.CLAUDE_API_KEY;

  const validDimensions = [
    { name: 'Military Readiness', score: 0.7, weight: 0.20, reasoning: 'Active deployments in theater' },
    { name: 'Political Will', score: 0.8, weight: 0.25, reasoning: 'Strong rhetoric from leadership' },
    { name: 'Target Urgency', score: 0.5, weight: 0.20, reasoning: 'Medium timeline pressure' },
    { name: 'Diplomatic Alternatives', score: 0.6, weight: 0.15, reasoning: 'Negotiations stalling' },
    { name: 'Regional Alliance Support', score: 0.4, weight: 0.10, reasoning: 'Mixed coalition signals' },
    { name: 'Provocation Level', score: 0.3, weight: 0.10, reasoning: 'Low-level incidents' },
  ];

  const validResponse = {
    dimensions: validDimensions,
    confidence: 'medium',
    analysis_text: 'Based on current indicators, the situation shows elevated but not imminent escalation risk.',
  };

  const makeApiResponse = (body: object, usage = { input_tokens: 500, output_tokens: 400 }) => ({
    ok: true,
    json: () => Promise.resolve({
      content: [{ type: 'text', text: JSON.stringify(body) }],
      usage,
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
    if (originalEnv !== undefined) {
      process.env.CLAUDE_API_KEY = originalEnv;
    } else {
      delete process.env.CLAUDE_API_KEY;
    }
  });

  it('returns structured 6-dimension output', async () => {
    mockFetch.mock.mockImplementationOnce(() => Promise.resolve(makeApiResponse(validResponse)));
    const result = await handleAssessment({ query: 'Iran escalation', region: 'middle-east', timeframe: '7d', evidence: [] });
    assert.strictEqual(result.status, 'ok');
    assert.strictEqual(result.dimensions.length, 6);
    assert.strictEqual(result.dimensions[0].name, 'Military Readiness');
    assert.strictEqual(result.dimensions[1].name, 'Political Will');
    assert.strictEqual(result.dimensions[2].name, 'Target Urgency');
    assert.strictEqual(result.dimensions[3].name, 'Diplomatic Alternatives');
    assert.strictEqual(result.dimensions[4].name, 'Regional Alliance Support');
    assert.strictEqual(result.dimensions[5].name, 'Provocation Level');
  });

  it('clamps scores to 0.0-1.0 range', async () => {
    const badScores = {
      ...validResponse,
      dimensions: [
        { name: 'Military Readiness', score: 1.5, weight: 0.20, reasoning: 'Over max' },
        { name: 'Political Will', score: -0.3, weight: 0.25, reasoning: 'Below min' },
        { name: 'Target Urgency', score: 2.0, weight: 0.20, reasoning: 'Way over' },
        { name: 'Diplomatic Alternatives', score: -1.0, weight: 0.15, reasoning: 'Way under' },
        { name: 'Regional Alliance Support', score: 0.5, weight: 0.10, reasoning: 'Normal' },
        { name: 'Provocation Level', score: 0.3, weight: 0.10, reasoning: 'Normal' },
      ],
    };
    mockFetch.mock.mockImplementationOnce(() => Promise.resolve(makeApiResponse(badScores)));
    const result = await handleAssessment({ query: 'test', region: '', timeframe: '7d', evidence: [] });
    assert.strictEqual(result.status, 'ok');
    assert.ok(result.dimensions[0].score <= 1.0, `Score should be clamped to max 1.0, got ${result.dimensions[0].score}`);
    assert.ok(result.dimensions[1].score >= 0.0, `Score should be clamped to min 0.0, got ${result.dimensions[1].score}`);
    assert.ok(result.dimensions[2].score <= 1.0, `Score should be clamped to max 1.0, got ${result.dimensions[2].score}`);
    assert.ok(result.dimensions[3].score >= 0.0, `Score should be clamped to min 0.0, got ${result.dimensions[3].score}`);
  });

  it('normalizes weights to sum to 1.0', async () => {
    const doubleWeights = {
      ...validResponse,
      dimensions: validDimensions.map(d => ({ ...d, weight: d.weight * 2 })),
    };
    mockFetch.mock.mockImplementationOnce(() => Promise.resolve(makeApiResponse(doubleWeights)));
    const result = await handleAssessment({ query: 'test', region: '', timeframe: '7d', evidence: [] });
    assert.strictEqual(result.status, 'ok');
    const weightSum = result.dimensions.reduce((s, d) => s + d.weight, 0);
    assert.ok(Math.abs(weightSum - 1.0) < 0.02, `Weights should sum to ~1.0, got ${weightSum}`);
  });

  it('computes overall_probability as weighted sum of dimension scores', async () => {
    mockFetch.mock.mockImplementationOnce(() => Promise.resolve(makeApiResponse(validResponse)));
    const result = await handleAssessment({ query: 'test', region: '', timeframe: '7d', evidence: [] });
    // Manual calculation: 0.7*0.2 + 0.8*0.25 + 0.5*0.2 + 0.6*0.15 + 0.4*0.1 + 0.3*0.1
    // = 0.14 + 0.20 + 0.10 + 0.09 + 0.04 + 0.03 = 0.60
    const expected = validDimensions.reduce((s, d) => s + d.score * d.weight, 0);
    assert.ok(Math.abs(result.overallProbability - expected) < 0.01,
      `Expected ~${expected.toFixed(3)}, got ${result.overallProbability}`);
  });

  it('includes disclaimer in every response', async () => {
    mockFetch.mock.mockImplementationOnce(() => Promise.resolve(makeApiResponse(validResponse)));
    const result = await handleAssessment({ query: 'test', region: '', timeframe: '7d', evidence: [] });
    assert.ok(result.disclaimer.length > 0, 'Disclaimer should not be empty');
    assert.ok(result.disclaimer.includes('AI-generated'), 'Disclaimer should mention AI-generated');
    assert.ok(result.disclaimer.includes('not be used as the sole basis'), 'Disclaimer should warn against sole reliance');
  });

  it('includes disclaimer even on error responses', async () => {
    delete process.env.CLAUDE_API_KEY;
    const result = await handleAssessment({ query: 'test', region: '', timeframe: '7d', evidence: [] });
    assert.strictEqual(result.status, 'error');
    assert.ok(result.disclaimer.length > 0, 'Disclaimer should be present even on error');
  });

  it('returns error when API key is missing', async () => {
    delete process.env.CLAUDE_API_KEY;
    const result = await handleAssessment({ query: 'test', region: '', timeframe: '7d', evidence: [] });
    assert.strictEqual(result.status, 'error');
    assert.ok(result.errorMessage.includes('API key'), 'Error should mention API key');
  });

  it('returns error on API failure (non-ok status)', async () => {
    mockFetch.mock.mockImplementationOnce(() => Promise.resolve({ ok: false, status: 503 }));
    const result = await handleAssessment({ query: 'test', region: '', timeframe: '7d', evidence: [] });
    assert.strictEqual(result.status, 'error');
    assert.ok(result.errorMessage.includes('503'), 'Error should include status code');
  });

  it('handles invalid JSON from Claude gracefully', async () => {
    mockFetch.mock.mockImplementationOnce(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        content: [{ type: 'text', text: 'This is not valid JSON at all' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      }),
    }));
    const result = await handleAssessment({ query: 'test', region: '', timeframe: '7d', evidence: [] });
    assert.strictEqual(result.status, 'error');
    assert.ok(result.errorMessage.length > 0, 'Should have an error message for invalid JSON');
  });

  it('handles timeout via AbortController', async () => {
    mockFetch.mock.mockImplementationOnce((_url: string, opts: any) => {
      assert.ok(opts.signal instanceof AbortSignal, 'Should pass an AbortSignal');
      return Promise.reject(new Error('The operation was aborted'));
    });
    const result = await handleAssessment({ query: 'test', region: '', timeframe: '7d', evidence: [] });
    assert.strictEqual(result.status, 'error');
    assert.ok(result.errorMessage.includes('aborted'), 'Error should mention abort');
  });

  it('sends evidence in user content when provided', async () => {
    mockFetch.mock.mockImplementationOnce(() => Promise.resolve(makeApiResponse(validResponse)));
    await handleAssessment({
      query: 'Iran escalation',
      region: 'middle-east',
      timeframe: '30d',
      evidence: ['Evidence piece 1', 'Evidence piece 2'],
    });
    const body = JSON.parse(mockFetch.mock.calls[0].arguments[1].body);
    const userMsg = body.messages[0].content;
    assert.ok(userMsg.includes('Evidence piece 1'), 'User content should include evidence');
    assert.ok(userMsg.includes('Evidence piece 2'), 'User content should include all evidence pieces');
  });

  it('uses Sonnet model for assessment', async () => {
    mockFetch.mock.mockImplementationOnce(() => Promise.resolve(makeApiResponse(validResponse)));
    await handleAssessment({ query: 'test', region: '', timeframe: '7d', evidence: [] });
    const body = JSON.parse(mockFetch.mock.calls[0].arguments[1].body);
    assert.ok(body.model.includes('sonnet'), `Expected model to include 'sonnet', got: ${body.model}`);
  });

  it('sets modelUsed in successful response', async () => {
    mockFetch.mock.mockImplementationOnce(() => Promise.resolve(makeApiResponse(validResponse)));
    const result = await handleAssessment({ query: 'test', region: '', timeframe: '7d', evidence: [] });
    assert.strictEqual(result.status, 'ok');
    assert.ok(result.modelUsed.includes('sonnet'), 'modelUsed should contain sonnet');
  });

  it('sets cachedAt timestamp in successful response', async () => {
    const before = Date.now();
    mockFetch.mock.mockImplementationOnce(() => Promise.resolve(makeApiResponse(validResponse)));
    const result = await handleAssessment({ query: 'test', region: '', timeframe: '7d', evidence: [] });
    const after = Date.now();
    assert.ok(result.cachedAt >= before && result.cachedAt <= after, 'cachedAt should be a current timestamp');
  });
});
