import type {
  ServerContext,
  GetHumanitarianSummaryBatchRequest,
  GetHumanitarianSummaryBatchResponse,
  HumanitarianCountrySummary,
} from '../../../../src/generated/server/worldmonitor/conflict/v1/service_server';

import { getCachedJsonBatch, cachedFetchJson } from '../../../_shared/redis';
import { CHROME_UA } from '../../../_shared/constants';

const REDIS_CACHE_KEY = 'conflict:humanitarian:v1';
const REDIS_CACHE_TTL = 21600;
const ISO2_PATTERN = /^[A-Z]{2}$/;

const ISO2_TO_ISO3: Record<string, string> = {
  US: 'USA', RU: 'RUS', CN: 'CHN', UA: 'UKR', IR: 'IRN',
  IL: 'ISR', TW: 'TWN', KP: 'PRK', SA: 'SAU', TR: 'TUR',
  PL: 'POL', DE: 'DEU', FR: 'FRA', GB: 'GBR', IN: 'IND',
  PK: 'PAK', SY: 'SYR', YE: 'YEM', MM: 'MMR', VE: 'VEN',
  AF: 'AFG', SD: 'SDN', SS: 'SSD', SO: 'SOM', CD: 'COD',
  ET: 'ETH', IQ: 'IRQ', CO: 'COL', NG: 'NGA', PS: 'PSE',
  BR: 'BRA', AE: 'ARE',
};

interface HapiCountryAgg {
  iso3: string;
  locationName: string;
  month: string;
  eventsTotal: number;
  eventsPoliticalViolence: number;
  eventsCivilianTargeting: number;
  eventsDemonstrations: number;
  fatalitiesTotalPoliticalViolence: number;
  fatalitiesTotalCivilianTargeting: number;
}

async function fetchSingleHapiSummary(countryCode: string): Promise<HumanitarianCountrySummary | undefined> {
  try {
    const iso3 = ISO2_TO_ISO3[countryCode.toUpperCase()];
    if (!iso3) return undefined;

    const appId = btoa('worldmonitor:monitor@worldmonitor.app');
    const url = `https://hapi.humdata.org/api/v2/coordination-context/conflict-events?output_format=json&limit=1000&offset=0&app_identifier=${appId}&location_code=${iso3}`;

    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': CHROME_UA },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return undefined;

    const rawData = await response.json();
    const records: any[] = rawData.data || [];

    const byCountry: Record<string, HapiCountryAgg> = {};
    for (const r of records) {
      const rIso3 = r.location_code || '';
      if (!rIso3) continue;
      const month = r.reference_period_start || '';
      const eventType = (r.event_type || '').toLowerCase();
      const events = r.events || 0;
      const fatalities = r.fatalities || 0;

      if (!byCountry[rIso3]) {
        byCountry[rIso3] = {
          iso3: rIso3, locationName: r.location_name || '', month,
          eventsTotal: 0, eventsPoliticalViolence: 0, eventsCivilianTargeting: 0,
          eventsDemonstrations: 0, fatalitiesTotalPoliticalViolence: 0, fatalitiesTotalCivilianTargeting: 0,
        };
      }

      const c = byCountry[rIso3];
      if (month > c.month) {
        c.month = month;
        c.eventsTotal = 0; c.eventsPoliticalViolence = 0; c.eventsCivilianTargeting = 0;
        c.eventsDemonstrations = 0; c.fatalitiesTotalPoliticalViolence = 0; c.fatalitiesTotalCivilianTargeting = 0;
      }
      if (month === c.month) {
        c.eventsTotal += events;
        if (eventType.includes('political_violence')) { c.eventsPoliticalViolence += events; c.fatalitiesTotalPoliticalViolence += fatalities; }
        if (eventType.includes('civilian_targeting')) { c.eventsCivilianTargeting += events; c.fatalitiesTotalCivilianTargeting += fatalities; }
        if (eventType.includes('demonstration')) { c.eventsDemonstrations += events; }
      }
    }

    const entry = byCountry[iso3];
    if (!entry) return undefined;

    return {
      countryCode: countryCode.toUpperCase(),
      countryName: entry.locationName,
      conflictEventsTotal: entry.eventsTotal,
      conflictPoliticalViolenceEvents: entry.eventsPoliticalViolence + entry.eventsCivilianTargeting,
      conflictFatalities: entry.fatalitiesTotalPoliticalViolence + entry.fatalitiesTotalCivilianTargeting,
      referencePeriod: entry.month,
      conflictDemonstrations: entry.eventsDemonstrations,
      updatedAt: Date.now(),
    };
  } catch {
    return undefined;
  }
}

export async function getHumanitarianSummaryBatch(
  _ctx: ServerContext,
  req: GetHumanitarianSummaryBatchRequest,
): Promise<GetHumanitarianSummaryBatchResponse> {
  try {
    const normalized = req.countryCodes
      .map((c) => c.trim().toUpperCase())
      .filter((c) => ISO2_PATTERN.test(c));
    const uniqueSorted = Array.from(new Set(normalized)).sort();
    const limitedList = uniqueSorted.slice(0, 25);

    const results: Record<string, HumanitarianCountrySummary> = {};
    const toFetch: string[] = [];

    const cacheKeys = limitedList.map((cc) => `${REDIS_CACHE_KEY}:${cc}`);
    const cachedMap = await getCachedJsonBatch(cacheKeys);

    for (let i = 0; i < limitedList.length; i++) {
      const cc = limitedList[i]!;
      const cached = cachedMap.get(cacheKeys[i]!) as { summary?: HumanitarianCountrySummary } | undefined;
      if (cached?.summary) {
        results[cc] = cached.summary;
      } else if (cached === undefined) {
        toFetch.push(cc);
      }
    }

    const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    for (let i = 0; i < toFetch.length; i++) {
      const cc = toFetch[i]!;
      const cacheResult = await cachedFetchJson<{ summary?: HumanitarianCountrySummary }>(
        `${REDIS_CACHE_KEY}:${cc}`,
        REDIS_CACHE_TTL,
        async () => {
          const summary = await fetchSingleHapiSummary(cc);
          return summary ? { summary } : null;
        },
      );
      if (cacheResult?.summary) results[cc] = cacheResult.summary;
      if (i < toFetch.length - 1) await delay(100);
    }

    return {
      results,
      fetched: Object.keys(results).length,
      requested: limitedList.length,
    };
  } catch {
    return { results: {}, fetched: 0, requested: 0 };
  }
}
