import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { listNavigationalWarnings } from '../server/worldmonitor/maritime/v1/list-navigational-warnings.ts';
import { getShippingRates } from '../server/worldmonitor/supply-chain/v1/get-shipping-rates.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function jsonResponse(data, ok = true) {
  return new Response(JSON.stringify(data), {
    status: ok ? 200 : 500,
    headers: { 'content-type': 'application/json' },
  });
}

function parseRedisKey(rawUrl, op) {
  const marker = `/${op}/`;
  const idx = rawUrl.indexOf(marker);
  if (idx === -1) return '';
  return decodeURIComponent(rawUrl.slice(idx + marker.length).split('/')[0] || '');
}

function withEnv(overrides) {
  const previous = new Map();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return () => {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

describe('country deep dive accuracy contract', () => {
  const src = readFileSync(resolve(root, 'src/app/country-intel.ts'), 'utf-8');

  it('pulls country macro data from World Bank and stock services', () => {
    assert.match(src, /EconomicServiceClient/);
    assert.match(src, /COUNTRY_ECONOMIC_INDICATORS/);
    assert.match(src, /source:\s*'World Bank'/);
    assert.match(src, /source:\s*'Market Service'/);
  });

  it('does not backfill the economic card with CII or displacement heuristics', () => {
    assert.doesNotMatch(src, /label:\s*'Instability Regime'/);
    assert.doesNotMatch(src, /label:\s*'Displacement Outflow'/);
    assert.doesNotMatch(src, /source:\s*'CII'/);
    assert.doesNotMatch(src, /UN-style displacement feed/);
  });

  it('requests a live refresh for country briefs', () => {
    assert.match(src, /params\.set\('refresh', '1'\)/);
  });
});

describe('SupplyChainPanel accuracy contract', () => {
  const src = readFileSync(resolve(root, 'src/components/SupplyChainPanel.ts'), 'utf-8');

  it('renders provenance metadata for supply chain sub-sections', () => {
    assert.match(src, /renderDataProvenanceHtml/);
    assert.match(src, /renderSection\(/);
  });

  it('no longer treats any chokepoint payload as shipping data presence', () => {
    assert.doesNotMatch(src, /\|\|\s*this\.chokepointData\s*!==\s*null/);
    assert.match(src, /shippingRateCount > 0 \|\| \(this\.chokepointData\?\.chokepoints\?\.length \?\? 0\) > 0/);
  });

  it('shows the top-level unavailable banner only when the active view truly has no data', () => {
    assert.match(src, /!activeHasData && activeUpstreamUnavailable/);
  });
});

describe('maritime provenance handling', () => {
  it('returns live navigational warnings with provenance on upstream success', async () => {
    const restoreEnv = withEnv({
      UPSTASH_REDIS_REST_URL: 'https://redis.test',
      UPSTASH_REDIS_REST_TOKEN: 'token',
    });
    const originalFetch = globalThis.fetch;
    const store = new Map();

    globalThis.fetch = async (url) => {
      const raw = String(url);
      if (raw.includes('/get/')) {
        const key = parseRedisKey(raw, 'get');
        return jsonResponse({ result: store.get(key) });
      }
      if (raw.includes('/set/')) {
        const key = parseRedisKey(raw, 'set');
        const encodedValue = raw.slice(raw.indexOf('/set/') + 5).split('/')[1] || '';
        store.set(key, decodeURIComponent(encodedValue));
        return jsonResponse({ result: 'OK' });
      }
      if (raw.includes('msi.nga.mil')) {
        return jsonResponse([
          {
            navArea: 'IV',
            msgYear: '2026',
            msgNumber: '101',
            text: 'Hazard to navigation in the Caribbean Sea',
            subregion: 'Caribbean Sea',
            issueDate: '081653Z MAY 2026',
            authority: 'NGA',
          },
        ]);
      }
      throw new Error(`Unexpected fetch URL: ${raw}`);
    };

    try {
      const result = await listNavigationalWarnings(
        { request: new Request('https://example.com/api/maritime/v1/list-navigational-warnings?area=caribbean') },
        { area: 'caribbean', pageSize: 0, cursor: '' },
      );
      assert.equal(result.cached, false);
      assert.equal(result.sourceMode, 'live');
      assert.equal(result.upstreamUnavailable, false);
      assert.equal(result.warnings.length, 1);
      assert.ok(result.fetchedAt.length > 0);
    } finally {
      globalThis.fetch = originalFetch;
      restoreEnv();
    }
  });

  it('returns cached warnings with upstreamUnavailable when a forced refresh fails', async () => {
    const restoreEnv = withEnv({
      UPSTASH_REDIS_REST_URL: 'https://redis.test',
      UPSTASH_REDIS_REST_TOKEN: 'token',
    });
    const originalFetch = globalThis.fetch;
    const store = new Map();
    const cachedPayload = {
      warnings: [{ id: 'cached-1', title: 'Cached warning', text: 'cached', area: 'Test', issuedAt: 1, expiresAt: 0, authority: 'NGA' }],
      pagination: undefined,
      fetchedAt: '2026-03-24T12:00:00.000Z',
      cached: false,
      upstreamUnavailable: false,
      sourceMode: 'live',
    };
    store.set('maritime:navwarnings:v1:all', JSON.stringify(cachedPayload));

    globalThis.fetch = async (url) => {
      const raw = String(url);
      if (raw.includes('/get/')) {
        const key = parseRedisKey(raw, 'get');
        return jsonResponse({ result: store.get(key) });
      }
      if (raw.includes('msi.nga.mil')) {
        throw new Error('upstream unavailable');
      }
      throw new Error(`Unexpected fetch URL: ${raw}`);
    };

    try {
      const result = await listNavigationalWarnings(
        { request: new Request('https://example.com/api/maritime/v1/list-navigational-warnings?refresh=1') },
        { area: '', pageSize: 0, cursor: '' },
      );
      assert.equal(result.cached, true);
      assert.equal(result.sourceMode, 'cached');
      assert.equal(result.upstreamUnavailable, true);
      assert.equal(result.warnings.length, 1);
      assert.equal(result.fetchedAt, '2026-03-24T12:00:00.000Z');
    } finally {
      globalThis.fetch = originalFetch;
      restoreEnv();
    }
  });

  it('returns cache-hit warnings without touching upstream when cache is warm', async () => {
    const restoreEnv = withEnv({
      UPSTASH_REDIS_REST_URL: 'https://redis.test',
      UPSTASH_REDIS_REST_TOKEN: 'token',
    });
    const originalFetch = globalThis.fetch;
    const store = new Map();
    store.set('maritime:navwarnings:v1:all', JSON.stringify({
      warnings: [{ id: 'cached-2', title: 'Warm cache', text: 'cached', area: 'Test', issuedAt: 1, expiresAt: 0, authority: 'NGA' }],
      pagination: undefined,
      fetchedAt: '2026-03-24T13:00:00.000Z',
      cached: false,
      upstreamUnavailable: false,
      sourceMode: 'live',
    }));
    let upstreamCalls = 0;

    globalThis.fetch = async (url) => {
      const raw = String(url);
      if (raw.includes('/get/')) {
        const key = parseRedisKey(raw, 'get');
        return jsonResponse({ result: store.get(key) });
      }
      if (raw.includes('msi.nga.mil')) {
        upstreamCalls += 1;
        throw new Error('upstream should not be called on cache hit');
      }
      throw new Error(`Unexpected fetch URL: ${raw}`);
    };

    try {
      const result = await listNavigationalWarnings(
        { request: new Request('https://example.com/api/maritime/v1/list-navigational-warnings') },
        { area: '', pageSize: 0, cursor: '' },
      );
      assert.equal(result.cached, true);
      assert.equal(result.sourceMode, 'cached');
      assert.equal(result.upstreamUnavailable, false);
      assert.equal(result.warnings.length, 1);
      assert.equal(upstreamCalls, 0);
    } finally {
      globalThis.fetch = originalFetch;
      restoreEnv();
    }
  });

  it('returns unavailable warnings when refresh fails and no cache exists', async () => {
    const restoreEnv = withEnv({
      UPSTASH_REDIS_REST_URL: 'https://redis.test',
      UPSTASH_REDIS_REST_TOKEN: 'token',
    });
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async (url) => {
      const raw = String(url);
      if (raw.includes('/get/')) {
        return jsonResponse({ result: null });
      }
      if (raw.includes('msi.nga.mil')) {
        return jsonResponse({}, false);
      }
      throw new Error(`Unexpected fetch URL: ${raw}`);
    };

    try {
      const result = await listNavigationalWarnings(
        { request: new Request('https://example.com/api/maritime/v1/list-navigational-warnings?refresh=1') },
        { area: '', pageSize: 0, cursor: '' },
      );
      assert.equal(result.cached, false);
      assert.equal(result.sourceMode, 'unavailable');
      assert.equal(result.upstreamUnavailable, true);
      assert.deepEqual(result.warnings, []);
      assert.equal(result.fetchedAt, '');
    } finally {
      globalThis.fetch = originalFetch;
      restoreEnv();
    }
  });
});

describe('supply chain shipping provenance handling', () => {
  it('labels cached seeded shipping data as cached instead of empty success', async () => {
    const restoreEnv = withEnv({
      UPSTASH_REDIS_REST_URL: 'https://redis.test',
      UPSTASH_REDIS_REST_TOKEN: 'token',
    });
    const originalFetch = globalThis.fetch;
    const store = new Map();
    store.set('supply_chain:shipping:v2', JSON.stringify({
      indices: [{ indexId: 'SCFI', name: 'SCFI', currentValue: 1000, previousValue: 950, changePct: 5.2, unit: 'pts', history: [], spikeAlert: false }],
      fetchedAt: '2026-03-24T12:00:00.000Z',
      upstreamUnavailable: false,
    }));

    globalThis.fetch = async (url) => {
      const raw = String(url);
      if (raw.includes('/get/')) {
        const key = parseRedisKey(raw, 'get');
        return jsonResponse({ result: store.get(key) });
      }
      throw new Error(`Unexpected fetch URL: ${raw}`);
    };

    try {
      const result = await getShippingRates({}, {});
      assert.equal(result.cached, true);
      assert.equal(result.sourceMode, 'cached');
      assert.equal(result.upstreamUnavailable, false);
      assert.equal(result.indices.length, 1);
    } finally {
      globalThis.fetch = originalFetch;
      restoreEnv();
    }
  });
});
