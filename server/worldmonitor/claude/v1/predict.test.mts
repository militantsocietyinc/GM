import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { handlePredict } from './predict.ts';

describe('handlePredict', () => {
  let mockFetch: ReturnType<typeof mock.fn>;
  const originalFetch = globalThis.fetch;
  const originalEnv = process.env.CLAUDE_API_KEY;

  const validResponse = {
    dimensions: [
      { name: 'Military Readiness', score: 0.7, weight: 0.2, reasoning: 'Active deployments' },
      { name: 'Political Will', score: 0.8, weight: 0.25, reasoning: 'Strong leadership signals' },
      { name: 'Target Urgency', score: 0.5, weight: 0.2, reasoning: 'Medium timeline' },
      { name: 'Diplomatic Alternatives', score: 0.3, weight: 0.15, reasoning: 'Negotiations stalled' },
      { name: 'Allied Support', score: 0.6, weight: 0.1, reasoning: 'Coalition forming' },
      { name: 'Provocation Level', score: 0.4, weight: 0.1, reasoning: 'Moderate incidents' },
    ],
    overall_probability: 0.65,
    confidence: 'medium',
    timeframe: '7 days',
    narrative: 'Escalation likely given current posture.',
  };

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

  it('returns prediction with dimension scores using Sonnet model', async () => {
    mockFetch.mock.mockImplementationOnce(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        content: [{ type: 'text', text: JSON.stringify(validResponse) }],
        usage: { input_tokens: 300, output_tokens: 250 },
      }),
    }));
    const result = await handlePredict({ scenario: 'Iran escalation', evidence: ['e1'], timeframe: '7d' });
    assert.strictEqual(result.status, 'ok');
    assert.strictEqual(result.dimensions.length, 6);
    assert.strictEqual(result.overallProbability, 0.65);
    assert.strictEqual(result.confidence, 'medium');
    assert.strictEqual(result.timeframe, '7 days');
    assert.ok(result.narrative.length > 0);
    assert.strictEqual(result.inputTokens, 300);
    assert.strictEqual(result.outputTokens, 250);
    // Verify Sonnet model used
    const body = JSON.parse(mockFetch.mock.calls[0].arguments[1].body);
    assert.ok(body.model.includes('sonnet'), `Expected model to include 'sonnet', got: ${body.model}`);
  });

  it('validates dimension scores are clamped to 0.0-1.0', async () => {
    const badScores = {
      ...validResponse,
      dimensions: [
        { name: 'Military Readiness', score: 1.5, weight: 0.2, reasoning: 'Over' },
        { name: 'Political Will', score: -0.3, weight: 0.25, reasoning: 'Under' },
        { name: 'Target Urgency', score: 0.5, weight: 0.2, reasoning: 'Ok' },
        { name: 'Diplomatic Alternatives', score: 0.3, weight: 0.15, reasoning: 'Ok' },
        { name: 'Allied Support', score: 0.6, weight: 0.1, reasoning: 'Ok' },
        { name: 'Provocation Level', score: 0.4, weight: 0.1, reasoning: 'Ok' },
      ],
    };
    mockFetch.mock.mockImplementationOnce(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        content: [{ type: 'text', text: JSON.stringify(badScores) }],
        usage: { input_tokens: 100, output_tokens: 50 },
      }),
    }));
    const result = await handlePredict({ scenario: 'test', evidence: [], timeframe: '7d' });
    assert.strictEqual(result.status, 'ok');
    // Scores should be clamped
    assert.ok(result.dimensions[0].score <= 1.0, 'Score should be clamped to max 1.0');
    assert.ok(result.dimensions[1].score >= 0.0, 'Score should be clamped to min 0.0');
  });

  it('normalizes dimension weights to sum to 1.0', async () => {
    const badWeights = {
      ...validResponse,
      dimensions: validResponse.dimensions.map(d => ({ ...d, weight: d.weight * 2 })),
    };
    mockFetch.mock.mockImplementationOnce(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        content: [{ type: 'text', text: JSON.stringify(badWeights) }],
        usage: { input_tokens: 100, output_tokens: 50 },
      }),
    }));
    const result = await handlePredict({ scenario: 'test', evidence: [], timeframe: '7d' });
    assert.strictEqual(result.status, 'ok');
    const weightSum = result.dimensions.reduce((s, d) => s + d.weight, 0);
    assert.ok(Math.abs(weightSum - 1.0) < 0.02, `Weights should sum to ~1.0, got ${weightSum}`);
  });

  it('returns error status when API key missing', async () => {
    delete process.env.CLAUDE_API_KEY;
    const result = await handlePredict({ scenario: 'test', evidence: [], timeframe: '7d' });
    assert.strictEqual(result.status, 'error');
    assert.ok(result.errorMessage.length > 0);
  });

  it('returns error status on API failure', async () => {
    mockFetch.mock.mockImplementationOnce(() => Promise.resolve({ ok: false, status: 503 }));
    const result = await handlePredict({ scenario: 'test', evidence: [], timeframe: '7d' });
    assert.strictEqual(result.status, 'error');
    assert.ok(result.errorMessage.includes('503'));
  });

  it('handles timeout via AbortController', async () => {
    mockFetch.mock.mockImplementationOnce((_url: string, opts: any) => {
      assert.ok(opts.signal instanceof AbortSignal, 'Should pass an AbortSignal');
      return Promise.reject(new Error('The operation was aborted'));
    });
    const result = await handlePredict({ scenario: 'test', evidence: [], timeframe: '7d' });
    assert.strictEqual(result.status, 'error');
    assert.ok(result.errorMessage.includes('aborted'));
  });
});
