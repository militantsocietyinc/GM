import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractJson, validateDimensionScores } from './ai-response';

describe('extractJson', () => {
  it('parses plain JSON', () => {
    const result = extractJson<{ a: number }>('{"a": 1}');
    assert.strictEqual(result.a, 1);
  });

  it('extracts JSON from markdown code fences', () => {
    const result = extractJson<{ a: number }>('```json\n{"a": 1}\n```');
    assert.strictEqual(result.a, 1);
  });

  it('extracts JSON from triple backticks without language', () => {
    const result = extractJson<{ a: number }>('Here is the result:\n```\n{"a": 1}\n```\nDone.');
    assert.strictEqual(result.a, 1);
  });

  it('throws on non-JSON text', () => {
    assert.throws(() => extractJson('This is not JSON'));
  });

  it('handles nested objects', () => {
    const result = extractJson<{ d: { name: string }[] }>('{"d":[{"name":"test"}]}');
    assert.strictEqual(result.d[0].name, 'test');
  });
});

describe('validateDimensionScores', () => {
  it('clamps scores to 0-1 range', () => {
    const dims = [{ name: 'test', score: 1.5, weight: 0.2, reasoning: '' }];
    const result = validateDimensionScores(dims);
    assert.strictEqual(result[0].score, 1.0);
  });

  it('normalizes weights to sum to 1', () => {
    const dims = [
      { name: 'a', score: 0.5, weight: 0.5, reasoning: '' },
      { name: 'b', score: 0.5, weight: 0.5, reasoning: '' },
    ];
    const result = validateDimensionScores(dims);
    const sum = result.reduce((s, d) => s + d.weight, 0);
    assert.ok(Math.abs(sum - 1.0) < 0.01);
  });

  it('clamps negative scores to 0', () => {
    const dims = [{ name: 'test', score: -0.5, weight: 1.0, reasoning: '' }];
    const result = validateDimensionScores(dims);
    assert.strictEqual(result[0].score, 0);
  });

  it('normalizes unbalanced weights', () => {
    const dims = [
      { name: 'a', score: 0.8, weight: 1.0, reasoning: '' },
      { name: 'b', score: 0.3, weight: 3.0, reasoning: '' },
    ];
    const result = validateDimensionScores(dims);
    assert.ok(Math.abs(result[0].weight - 0.25) < 0.01);
    assert.ok(Math.abs(result[1].weight - 0.75) < 0.01);
  });
});
