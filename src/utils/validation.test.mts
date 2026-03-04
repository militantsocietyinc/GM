import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateStringParam,
  validateHexParam,
  validateNumberParam,
  sanitizeTextContent,
  sanitizeUrl,
} from './validation';

describe('validateStringParam', () => {
  it('rejects empty strings', () => {
    assert.throws(() => validateStringParam('', 'test'), { message: /test is required/ });
  });

  it('rejects null and undefined', () => {
    assert.throws(() => validateStringParam(null as any, 'test'), { message: /test is required/ });
    assert.throws(() => validateStringParam(undefined as any, 'test'), { message: /test is required/ });
  });

  it('rejects strings exceeding maxLength', () => {
    assert.throws(() => validateStringParam('a'.repeat(101), 'test', 100), { message: /test exceeds maximum length/ });
  });

  it('rejects strings not matching pattern', () => {
    assert.throws(() => validateStringParam('invalid!@#', 'subreddit', 50, /^[a-zA-Z0-9_]+$/), { message: /subreddit contains invalid characters/ });
  });

  it('accepts valid strings', () => {
    assert.strictEqual(validateStringParam('worldnews', 'subreddit', 50, /^[a-zA-Z0-9_]+$/), 'worldnews');
  });

  it('trims whitespace', () => {
    assert.strictEqual(validateStringParam('  test  ', 'field'), 'test');
  });
});

describe('validateHexParam', () => {
  it('validates 6-char ICAO24 hex codes', () => {
    assert.strictEqual(validateHexParam('a1b2c3', 'icao24'), 'a1b2c3');
    assert.strictEqual(validateHexParam('ABCDEF', 'icao24'), 'abcdef');
  });

  it('rejects non-hex strings', () => {
    assert.throws(() => validateHexParam('zzzzzz', 'icao24'), { message: /icao24 must be a valid hex string/ });
  });

  it('rejects wrong length', () => {
    assert.throws(() => validateHexParam('abc', 'icao24'));
  });
});

describe('validateNumberParam', () => {
  it('validates numbers within range', () => {
    assert.strictEqual(validateNumberParam(50, 'limit', 1, 100), 50);
  });

  it('clamps to range boundaries', () => {
    assert.strictEqual(validateNumberParam(200, 'limit', 1, 100, true), 100);
    assert.strictEqual(validateNumberParam(-5, 'limit', 1, 100, true), 1);
  });

  it('rejects numbers outside range when clamp=false', () => {
    assert.throws(() => validateNumberParam(200, 'limit', 1, 100), { message: /limit must be between 1 and 100/ });
  });

  it('returns default for null/undefined', () => {
    assert.strictEqual(validateNumberParam(undefined as any, 'limit', 1, 100, false, 25), 25);
  });
});

describe('sanitizeTextContent', () => {
  it('strips HTML tags', () => {
    assert.strictEqual(sanitizeTextContent('<b>hello</b> <script>alert(1)</script>'), 'hello');
  });

  it('limits length', () => {
    assert.strictEqual(sanitizeTextContent('a'.repeat(3000), 100).length, 100);
  });

  it('normalizes whitespace', () => {
    assert.strictEqual(sanitizeTextContent('hello   world\n\ntest'), 'hello world test');
  });
});

describe('sanitizeUrl', () => {
  it('accepts http/https URLs', () => {
    assert.strictEqual(sanitizeUrl('https://example.com/path'), 'https://example.com/path');
  });

  it('rejects javascript: URLs', () => {
    assert.strictEqual(sanitizeUrl('javascript:alert(1)'), '');
  });

  it('rejects data: URLs', () => {
    assert.strictEqual(sanitizeUrl('data:text/html,<h1>hi</h1>'), '');
  });

  it('returns empty for invalid URLs', () => {
    assert.strictEqual(sanitizeUrl('not-a-url'), '');
  });
});
