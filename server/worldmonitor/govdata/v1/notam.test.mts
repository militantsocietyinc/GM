import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// ========================================================================
// Mock FAA NOTAM API GeoJSON response
// ========================================================================

const MOCK_FAA_NOTAM_RESPONSE = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        coreNOTAMData: {
          notam: {
            id: 'A0001/26',
            type: 'N',
            location: 'KJFK',
            effectiveStart: '2026-03-01T00:00:00Z',
            effectiveEnd: '2026-03-31T23:59:00Z',
            text: 'RWY 04L/22R CLSD FOR MAINT',
            classification: 'NOTAM',
            schedule: '',
          },
        },
      },
      geometry: {
        type: 'Point',
        coordinates: [-73.7781, 40.6413],
      },
    },
    {
      type: 'Feature',
      properties: {
        coreNOTAMData: {
          notam: {
            id: 'FDC 6/0234',
            type: 'N',
            location: 'ZNY',
            effectiveStart: '2026-03-05T12:00:00Z',
            effectiveEnd: '2026-03-05T18:00:00Z',
            text: 'TEMPORARY FLIGHT RESTRICTION. SPORTING EVENT. METLIFE STADIUM, NJ.',
            classification: 'TFR',
            schedule: '',
          },
        },
      },
      geometry: {
        type: 'Point',
        coordinates: [-74.0744, 40.8128],
      },
    },
    {
      type: 'Feature',
      properties: {
        coreNOTAMData: {
          notam: {
            id: 'A0045/26',
            type: 'N',
            location: 'KORD',
            effectiveStart: '2026-02-20T06:00:00Z',
            effectiveEnd: '2026-04-15T12:00:00Z',
            text: 'VOR/DME ORD U/S',
            classification: 'NAVAID',
            schedule: '',
          },
        },
      },
      geometry: null,
    },
  ],
};

const MOCK_FAA_EMPTY_RESPONSE = {
  type: 'FeatureCollection',
  features: [],
};

// ========================================================================
// Tests
// ========================================================================

describe('notam handler — parseFaaNotamResponse', () => {
  let parseFaaNotamResponse: typeof import('./notam').parseFaaNotamResponse;

  beforeEach(async () => {
    const mod = await import('./notam.ts');
    parseFaaNotamResponse = mod.parseFaaNotamResponse;
  });

  it('parses a valid FAA GeoJSON response into Notam array', () => {
    const notams = parseFaaNotamResponse(MOCK_FAA_NOTAM_RESPONSE);
    assert.equal(notams.length, 3);
  });

  it('correctly maps NOTAM id, type, and description', () => {
    const notams = parseFaaNotamResponse(MOCK_FAA_NOTAM_RESPONSE);
    const first = notams[0]!;
    assert.equal(first.id, 'A0001/26');
    assert.equal(first.type, 'NOTAM');
    assert.equal(first.description, 'RWY 04L/22R CLSD FOR MAINT');
  });

  it('correctly extracts coordinates from GeoJSON geometry', () => {
    const notams = parseFaaNotamResponse(MOCK_FAA_NOTAM_RESPONSE);
    const first = notams[0]!;
    assert.equal(first.latitude, 40.6413);
    assert.equal(first.longitude, -73.7781);
  });

  it('handles null geometry gracefully (defaults to 0,0)', () => {
    const notams = parseFaaNotamResponse(MOCK_FAA_NOTAM_RESPONSE);
    const navaid = notams[2]!;
    assert.equal(navaid.latitude, 0);
    assert.equal(navaid.longitude, 0);
    assert.equal(navaid.type, 'NAVAID');
  });

  it('correctly maps TFR classification', () => {
    const notams = parseFaaNotamResponse(MOCK_FAA_NOTAM_RESPONSE);
    const tfr = notams[1]!;
    assert.equal(tfr.type, 'TFR');
    assert.ok(tfr.description.includes('TEMPORARY FLIGHT RESTRICTION'));
  });

  it('parses effective dates to epoch milliseconds', () => {
    const notams = parseFaaNotamResponse(MOCK_FAA_NOTAM_RESPONSE);
    const first = notams[0]!;
    assert.equal(first.effectiveFrom, Date.parse('2026-03-01T00:00:00Z'));
    assert.equal(first.effectiveTo, Date.parse('2026-03-31T23:59:00Z'));
  });

  it('sets source to FAA', () => {
    const notams = parseFaaNotamResponse(MOCK_FAA_NOTAM_RESPONSE);
    for (const n of notams) {
      assert.equal(n.source, 'FAA');
    }
  });

  it('returns empty array for empty feature collection', () => {
    const notams = parseFaaNotamResponse(MOCK_FAA_EMPTY_RESPONSE);
    assert.equal(notams.length, 0);
  });

  it('returns empty array for malformed input', () => {
    const notams = parseFaaNotamResponse(null);
    assert.equal(notams.length, 0);
    const notams2 = parseFaaNotamResponse({});
    assert.equal(notams2.length, 0);
    const notams3 = parseFaaNotamResponse('not json');
    assert.equal(notams3.length, 0);
  });

  it('extracts location identifier', () => {
    const notams = parseFaaNotamResponse(MOCK_FAA_NOTAM_RESPONSE);
    assert.equal(notams[0]!.location, 'KJFK');
    assert.equal(notams[1]!.location, 'ZNY');
    assert.equal(notams[2]!.location, 'KORD');
  });
});

describe('notam handler — listNotams RPC', () => {
  let listNotams: typeof import('./notam').listNotams;

  beforeEach(async () => {
    // Mock global fetch
    const mockFetch = mock.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
      return new Response(JSON.stringify(MOCK_FAA_NOTAM_RESPONSE), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    (globalThis as any).fetch = mockFetch;

    // Set env vars for the handler
    process.env.FAA_API_KEY = 'test-key';
    process.env.UPSTASH_REDIS_REST_URL = '';
    process.env.UPSTASH_REDIS_REST_TOKEN = '';

    const mod = await import('./notam.ts');
    listNotams = mod.listNotams;
  });

  it('returns a valid ListNotamsResponse structure', async () => {
    const ctx = { request: new Request('http://localhost'), pathParams: {}, headers: {} };
    const result = await listNotams(ctx as any, { region: '', limit: 0 });
    assert.ok(result.notams);
    assert.ok(Array.isArray(result.notams));
    assert.equal(result.status, 'ok');
    assert.equal(result.count, result.notams.length);
  });

  it('returns error status when FAA_API_KEY is missing', async () => {
    delete process.env.FAA_API_KEY;
    const ctx = { request: new Request('http://localhost'), pathParams: {}, headers: {} };
    const result = await listNotams(ctx as any, { region: '', limit: 0 });
    assert.equal(result.status, 'error');
    assert.ok(result.errorMessage.length > 0);
  });

  it('applies limit to results', async () => {
    const ctx = { request: new Request('http://localhost'), pathParams: {}, headers: {} };
    const result = await listNotams(ctx as any, { region: '', limit: 1 });
    assert.ok(result.notams.length <= 1);
  });

  it('handles fetch failure gracefully', async () => {
    (globalThis as any).fetch = mock.fn(async () => {
      throw new Error('Network error');
    });
    const ctx = { request: new Request('http://localhost'), pathParams: {}, headers: {} };
    const result = await listNotams(ctx as any, { region: '', limit: 0 });
    assert.equal(result.status, 'error');
    assert.ok(result.errorMessage.includes('Network error') || result.errorMessage.length > 0);
  });

  it('handles non-ok HTTP response gracefully', async () => {
    (globalThis as any).fetch = mock.fn(async () => {
      return new Response('Unauthorized', { status: 401 });
    });
    process.env.FAA_API_KEY = 'test-key';
    const ctx = { request: new Request('http://localhost'), pathParams: {}, headers: {} };
    const result = await listNotams(ctx as any, { region: '', limit: 0 });
    assert.equal(result.status, 'error');
  });
});
