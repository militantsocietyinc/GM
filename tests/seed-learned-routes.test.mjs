import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';

import { isAllowedRouteHost, bulkReadLearnedRoutes, bulkWriteLearnedRoutes } from '../scripts/_seed-utils.mjs';

// ---------------------------------------------------------------------------
// isAllowedRouteHost
// ---------------------------------------------------------------------------

describe('isAllowedRouteHost', () => {
  it('accepts URL matching a listed site exactly', () => {
    assert.equal(isAllowedRouteHost('https://carrefouruae.com/product/sugar', ['carrefouruae.com', 'noon.com']), true);
  });

  it('accepts URL with www. prefix', () => {
    assert.equal(isAllowedRouteHost('https://www.carrefouruae.com/product/sugar', ['carrefouruae.com']), true);
  });

  it('accepts subdomain of listed site', () => {
    assert.equal(isAllowedRouteHost('https://shop.luluhypermarket.com/en/sugar', ['luluhypermarket.com']), true);
  });

  it('rejects URL from unlisted hostname', () => {
    assert.equal(isAllowedRouteHost('https://numbeo.com/cost-of-living', ['carrefouruae.com']), false);
  });

  it('rejects malformed URL without throwing', () => {
    assert.equal(isAllowedRouteHost('not-a-url', ['carrefouruae.com']), false);
  });

  it('rejects empty string without throwing', () => {
    assert.equal(isAllowedRouteHost('', ['carrefouruae.com']), false);
  });
});

// ---------------------------------------------------------------------------
// Helpers — mock fetch for Redis tests
// ---------------------------------------------------------------------------

function withEnv(vars) {
  const original = {};
  for (const [k, v] of Object.entries(vars)) {
    original[k] = process.env[k];
    process.env[k] = v;
  }
  return () => {
    for (const [k, v] of Object.entries(original)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };
}

function mockFetch(handler) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  return () => { globalThis.fetch = original; };
}

// ---------------------------------------------------------------------------
// bulkReadLearnedRoutes
// ---------------------------------------------------------------------------

describe('bulkReadLearnedRoutes', () => {
  let restoreEnv;

  beforeEach(() => {
    restoreEnv = withEnv({
      UPSTASH_REDIS_REST_URL: 'https://redis.test',
      UPSTASH_REDIS_REST_TOKEN: 'tok',
    });
  });

  afterEach(() => {
    restoreEnv();
  });

  it('returns empty Map when keys array is empty (no fetch)', async () => {
    let fetchCalled = false;
    const restore = mockFetch(() => { fetchCalled = true; });
    const result = await bulkReadLearnedRoutes('grocery-basket', []);
    restore();
    assert.equal(fetchCalled, false);
    assert.equal(result.size, 0);
  });

  it('parses valid pipeline responses into Map', async () => {
    const route = { url: 'https://carrefouruae.com/sugar', lastSuccessAt: 1000, hits: 3, failsSinceSuccess: 0, currency: 'AED' };
    const restore = mockFetch(async () => ({
      ok: true,
      json: async () => [
        { result: JSON.stringify(route) },
        { result: null },
      ],
    }));
    const result = await bulkReadLearnedRoutes('grocery-basket', ['AE:sugar', 'AE:salt']);
    restore();
    assert.equal(result.size, 1);
    assert.deepEqual(result.get('AE:sugar'), route);
    assert.equal(result.has('AE:salt'), false);
  });

  it('skips malformed JSON entries without throwing', async () => {
    const restore = mockFetch(async () => ({
      ok: true,
      json: async () => [{ result: 'not-valid-json{{' }],
    }));
    const result = await bulkReadLearnedRoutes('grocery-basket', ['AE:sugar']);
    restore();
    assert.equal(result.size, 0);
  });

  it('throws on HTTP error (non-fatal: caller catches)', async () => {
    const restore = mockFetch(async () => ({ ok: false, status: 500 }));
    await assert.rejects(
      () => bulkReadLearnedRoutes('grocery-basket', ['AE:sugar']),
      /bulkReadLearnedRoutes HTTP 500/
    );
    restore();
  });
});

// ---------------------------------------------------------------------------
// bulkWriteLearnedRoutes
// ---------------------------------------------------------------------------

describe('bulkWriteLearnedRoutes', () => {
  let restoreEnv;

  beforeEach(() => {
    restoreEnv = withEnv({
      UPSTASH_REDIS_REST_URL: 'https://redis.test',
      UPSTASH_REDIS_REST_TOKEN: 'tok',
    });
  });

  afterEach(() => {
    restoreEnv();
  });

  it('no-ops when both maps are empty (no fetch)', async () => {
    let fetchCalled = false;
    const restore = mockFetch(() => { fetchCalled = true; });
    await bulkWriteLearnedRoutes('grocery-basket', new Map(), new Set());
    restore();
    assert.equal(fetchCalled, false);
  });

  it('sends SET with 14-day TTL for updated keys', async () => {
    let capturedBody;
    const restore = mockFetch(async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, json: async () => [] };
    });
    const route = { url: 'https://carrefouruae.com/sugar', lastSuccessAt: 1000, hits: 1, failsSinceSuccess: 0, currency: 'AED' };
    await bulkWriteLearnedRoutes('grocery-basket', new Map([['AE:sugar', route]]), new Set());
    restore();
    assert.equal(capturedBody.length, 1);
    const [cmd, key, val, ex, ttl] = capturedBody[0];
    assert.equal(cmd, 'SET');
    assert.equal(key, 'seed-routes:grocery-basket:AE:sugar');
    assert.deepEqual(JSON.parse(val), route);
    assert.equal(ex, 'EX');
    assert.equal(ttl, 14 * 24 * 3600);
  });

  it('sends DEL for evicted keys not in updates', async () => {
    let capturedBody;
    const restore = mockFetch(async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, json: async () => [] };
    });
    await bulkWriteLearnedRoutes('grocery-basket', new Map(), new Set(['AE:sugar']));
    restore();
    assert.equal(capturedBody.length, 1);
    assert.equal(capturedBody[0][0], 'DEL');
    assert.equal(capturedBody[0][1], 'seed-routes:grocery-basket:AE:sugar');
  });

  it('SET wins when key is in both updates and deletes — DEL not sent', async () => {
    let capturedBody;
    const restore = mockFetch(async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, json: async () => [] };
    });
    const route = { url: 'https://carrefouruae.com/sugar', lastSuccessAt: 1000, hits: 1, failsSinceSuccess: 0, currency: 'AED' };
    await bulkWriteLearnedRoutes(
      'grocery-basket',
      new Map([['AE:sugar', route]]),
      new Set(['AE:sugar']) // same key
    );
    restore();
    // Only SET, no DEL
    assert.equal(capturedBody.length, 1);
    assert.equal(capturedBody[0][0], 'SET');
  });

  it('sends DELs before SETs in pipeline', async () => {
    let capturedBody;
    const restore = mockFetch(async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, json: async () => [] };
    });
    const route = { url: 'https://carrefouruae.com/salt', lastSuccessAt: 1000, hits: 1, failsSinceSuccess: 0, currency: 'AED' };
    await bulkWriteLearnedRoutes(
      'grocery-basket',
      new Map([['AE:salt', route]]),
      new Set(['AE:sugar']) // different key — both should appear
    );
    restore();
    assert.equal(capturedBody.length, 2);
    assert.equal(capturedBody[0][0], 'DEL');  // DEL first
    assert.equal(capturedBody[1][0], 'SET');  // SET second
  });

  it('throws on HTTP error', async () => {
    const restore = mockFetch(async () => ({ ok: false, status: 503 }));
    const route = { url: 'https://carrefouruae.com/sugar', lastSuccessAt: 1000, hits: 1, failsSinceSuccess: 0, currency: 'AED' };
    await assert.rejects(
      () => bulkWriteLearnedRoutes('grocery-basket', new Map([['AE:sugar', route]]), new Set()),
      /bulkWriteLearnedRoutes HTTP 503/
    );
    restore();
  });
});
