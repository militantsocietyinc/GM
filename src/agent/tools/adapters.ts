/**
 * Service Adapters — bridge existing WorldMonitor services into the tool registry.
 *
 * Each adapter wraps an existing service's fetch function, converts output
 * into canonical Signal format, and registers itself as a tool.
 */

import type { Signal, Severity } from '../types';
import { registerTool, createSignal } from './registry';

// ============================================================================
// ADAPTER: News/RSS → Signal
// ============================================================================

registerTool({
  id: 'news.rss',
  name: 'RSS News Fetcher',
  description: 'Fetches and clusters news from 150+ RSS feeds',
  domains: ['news'],
  inputSchema: { type: 'object', properties: { maxItems: { type: 'number' } } },
  outputDomain: 'news',
  concurrency: 2,
  timeout: 30_000,
  async execute(input) {
    // Lazy import to avoid circular dependency at module load
    const { fetchAndCluster } = await import('@/services/rss');
    const clusters = await fetchAndCluster();
    const maxItems = (input.maxItems as number) ?? 100;

    return clusters.slice(0, maxItems).map(cluster =>
      createSignal('news', {
        sourceId: cluster.id,
        severity: clusterSeverity(cluster.sourceCount, cluster.isAlert),
        regions: [],
        timestamp: cluster.firstSeen.getTime(),
        payload: {
          title: cluster.primaryTitle,
          source: cluster.primarySource,
          link: cluster.primaryLink,
          sourceCount: cluster.sourceCount,
          isAlert: cluster.isAlert,
        },
        confidence: Math.min(1, cluster.sourceCount / 5),
        tags: ['news', 'rss'],
        provenance: 'tool:news.rss',
      })
    );
  },
});

// ============================================================================
// ADAPTER: Conflict Events → Signal
// ============================================================================

registerTool({
  id: 'conflict.acled',
  name: 'ACLED Conflict Events',
  description: 'Fetches armed conflict events from ACLED',
  domains: ['conflict'],
  inputSchema: { type: 'object', properties: { region: { type: 'string' } } },
  outputDomain: 'conflict',
  concurrency: 1,
  timeout: 20_000,
  async execute() {
    const { ConflictServiceClient } = await import(
      '@/generated/client/worldmonitor/conflict/v1/service_client'
    );
    const client = new ConflictServiceClient();
    const resp = await client.listAcledEvents({});
    return (resp.events ?? []).map(evt =>
      createSignal('conflict', {
        sourceId: `acled-${evt.eventId ?? evt.notes?.slice(0, 20)}`,
        severity: acledSeverity(evt.eventType ?? '', evt.fatalities ?? 0),
        regions: evt.iso3 ? [evt.iso3.slice(0, 2).toUpperCase()] : [],
        timestamp: evt.eventDate ? new Date(evt.eventDate).getTime() : Date.now(),
        geo: evt.latitude && evt.longitude
          ? { lat: evt.latitude, lon: evt.longitude }
          : undefined,
        payload: evt,
        confidence: 0.9,
        tags: ['conflict', 'acled', evt.eventType ?? ''],
        provenance: 'tool:conflict.acled',
      })
    );
  },
});

// ============================================================================
// ADAPTER: Military Flights → Signal
// ============================================================================

registerTool({
  id: 'military.flights',
  name: 'Military Flight Tracker',
  description: 'Fetches military aircraft positions and surge detection',
  domains: ['military'],
  inputSchema: { type: 'object' },
  outputDomain: 'military',
  concurrency: 1,
  timeout: 15_000,
  async execute() {
    const { MilitaryServiceClient } = await import(
      '@/generated/client/worldmonitor/military/v1/service_client'
    );
    const client = new MilitaryServiceClient();
    const resp = await client.listMilitaryFlights({});
    return (resp.flights ?? []).map(flight =>
      createSignal('military', {
        sourceId: `mil-${flight.icao24 ?? flight.callsign}`,
        severity: 'medium',
        regions: flight.originCountry ? [flight.originCountry] : [],
        timestamp: Date.now(),
        geo: flight.latitude && flight.longitude
          ? { lat: flight.latitude, lon: flight.longitude }
          : undefined,
        payload: flight,
        confidence: 0.85,
        tags: ['military', 'aviation', flight.callsign ?? ''],
        provenance: 'tool:military.flights',
      })
    );
  },
});

// ============================================================================
// ADAPTER: Cyber Threats → Signal
// ============================================================================

registerTool({
  id: 'cyber.threats',
  name: 'Cyber Threat Monitor',
  description: 'Fetches cyber threat advisories and incidents',
  domains: ['cyber'],
  inputSchema: { type: 'object' },
  outputDomain: 'cyber',
  concurrency: 1,
  timeout: 15_000,
  async execute() {
    const { CyberServiceClient } = await import(
      '@/generated/client/worldmonitor/cyber/v1/service_client'
    );
    const client = new CyberServiceClient();
    const resp = await client.listCyberThreats({});
    return (resp.threats ?? []).map(threat =>
      createSignal('cyber', {
        sourceId: `cyber-${threat.id}`,
        severity: mapCyberSeverity(threat.severity ?? ''),
        regions: [],
        timestamp: threat.publishedAt ? new Date(threat.publishedAt).getTime() : Date.now(),
        payload: threat,
        confidence: 0.8,
        tags: ['cyber', threat.type ?? ''],
        provenance: 'tool:cyber.threats',
      })
    );
  },
});

// ============================================================================
// ADAPTER: Seismology → Signal
// ============================================================================

registerTool({
  id: 'seismology.earthquakes',
  name: 'Earthquake Monitor',
  description: 'Fetches recent earthquake data',
  domains: ['seismology'],
  inputSchema: { type: 'object' },
  outputDomain: 'seismology',
  concurrency: 1,
  timeout: 15_000,
  async execute() {
    const { SeismologyServiceClient } = await import(
      '@/generated/client/worldmonitor/seismology/v1/service_client'
    );
    const client = new SeismologyServiceClient();
    const resp = await client.listEarthquakes({});
    return (resp.earthquakes ?? []).map(eq =>
      createSignal('seismology', {
        sourceId: `eq-${eq.id}`,
        severity: earthquakeSeverity(eq.magnitude ?? 0),
        regions: [],
        timestamp: eq.time ? new Date(eq.time).getTime() : Date.now(),
        geo: eq.latitude && eq.longitude
          ? { lat: eq.latitude, lon: eq.longitude }
          : undefined,
        payload: eq,
        confidence: 0.95,
        tags: ['earthquake', `mag${Math.floor(eq.magnitude ?? 0)}`],
        provenance: 'tool:seismology.earthquakes',
      })
    );
  },
});

// ============================================================================
// ADAPTER: Economic / Market → Signal
// ============================================================================

registerTool({
  id: 'economic.macro',
  name: 'Macro Economic Signals',
  description: 'Fetches FRED indicators and energy prices',
  domains: ['economic'],
  inputSchema: { type: 'object' },
  outputDomain: 'economic',
  concurrency: 1,
  timeout: 20_000,
  async execute() {
    const { EconomicServiceClient } = await import(
      '@/generated/client/worldmonitor/economic/v1/service_client'
    );
    const client = new EconomicServiceClient();
    const resp = await client.getMacroSignals({});
    return (resp.signals ?? []).map(sig =>
      createSignal('economic', {
        sourceId: `macro-${sig.id}`,
        severity: sig.direction === 'bearish' ? 'high' : sig.direction === 'bullish' ? 'low' : 'medium',
        regions: ['US'],
        timestamp: Date.now(),
        payload: sig,
        confidence: sig.confidence ?? 0.7,
        tags: ['economic', 'macro', sig.category ?? ''],
        provenance: 'tool:economic.macro',
      })
    );
  },
});

// ============================================================================
// ADAPTER: Infrastructure → Signal
// ============================================================================

registerTool({
  id: 'infrastructure.outages',
  name: 'Infrastructure Outage Monitor',
  description: 'Fetches internet outages and service disruptions',
  domains: ['infrastructure'],
  inputSchema: { type: 'object' },
  outputDomain: 'infrastructure',
  concurrency: 1,
  timeout: 15_000,
  async execute() {
    const { InfrastructureServiceClient } = await import(
      '@/generated/client/worldmonitor/infrastructure/v1/service_client'
    );
    const client = new InfrastructureServiceClient();
    const resp = await client.listInternetOutages({});
    return (resp.outages ?? []).map(outage =>
      createSignal('infrastructure', {
        sourceId: `outage-${outage.asn ?? outage.name}`,
        severity: outage.severity === 'major' ? 'high' : 'medium',
        regions: outage.countryCode ? [outage.countryCode] : [],
        timestamp: outage.startedAt ? new Date(outage.startedAt).getTime() : Date.now(),
        payload: outage,
        confidence: 0.85,
        tags: ['infrastructure', 'outage'],
        provenance: 'tool:infrastructure.outages',
      })
    );
  },
});

// ============================================================================
// ADAPTER: Unrest → Signal
// ============================================================================

registerTool({
  id: 'unrest.events',
  name: 'Social Unrest Tracker',
  description: 'Fetches protest and unrest events',
  domains: ['unrest'],
  inputSchema: { type: 'object' },
  outputDomain: 'unrest',
  concurrency: 1,
  timeout: 15_000,
  async execute() {
    const { UnrestServiceClient } = await import(
      '@/generated/client/worldmonitor/unrest/v1/service_client'
    );
    const client = new UnrestServiceClient();
    const resp = await client.listUnrestEvents({});
    return (resp.events ?? []).map(evt =>
      createSignal('unrest', {
        sourceId: `unrest-${evt.id ?? evt.title?.slice(0, 20)}`,
        severity: evt.fatalities && evt.fatalities > 0 ? 'high' : 'medium',
        regions: evt.countryCode ? [evt.countryCode] : [],
        timestamp: evt.date ? new Date(evt.date).getTime() : Date.now(),
        geo: evt.latitude && evt.longitude
          ? { lat: evt.latitude, lon: evt.longitude }
          : undefined,
        payload: evt,
        confidence: 0.8,
        tags: ['unrest', evt.eventType ?? ''],
        provenance: 'tool:unrest.events',
      })
    );
  },
});

// ============================================================================
// ADAPTER: Intelligence → Signal
// ============================================================================

registerTool({
  id: 'intelligence.risk',
  name: 'Risk Score Calculator',
  description: 'Fetches CII and strategic risk scores',
  domains: ['intelligence'],
  inputSchema: { type: 'object', properties: { region: { type: 'string' } } },
  outputDomain: 'intelligence',
  concurrency: 1,
  timeout: 20_000,
  async execute(input) {
    const { IntelligenceServiceClient } = await import(
      '@/generated/client/worldmonitor/intelligence/v1/service_client'
    );
    const client = new IntelligenceServiceClient();
    const resp = await client.getRiskScores({ region: input.region as string });

    const signals: Signal[] = [];

    for (const cii of resp.ciiScores ?? []) {
      signals.push(createSignal('intelligence', {
        sourceId: `cii-${cii.region}`,
        severity: ciiSeverity(cii.combinedScore ?? 0),
        regions: cii.region ? [cii.region] : [],
        timestamp: cii.computedAt ?? Date.now(),
        payload: cii,
        confidence: 0.9,
        tags: ['intelligence', 'cii', cii.trend ?? ''],
        provenance: 'tool:intelligence.risk',
      }));
    }

    return signals;
  },
});

// ============================================================================
// SEVERITY HELPERS
// ============================================================================

function clusterSeverity(sourceCount: number, isAlert: boolean): Severity {
  if (isAlert) return 'high';
  if (sourceCount >= 10) return 'high';
  if (sourceCount >= 5) return 'medium';
  if (sourceCount >= 2) return 'low';
  return 'info';
}

function acledSeverity(eventType: string, fatalities: number): Severity {
  if (fatalities > 50) return 'critical';
  if (fatalities > 10) return 'high';
  if (eventType.includes('battle') || eventType.includes('explosion')) return 'high';
  if (eventType.includes('violence')) return 'medium';
  return 'low';
}

function mapCyberSeverity(s: string): Severity {
  const lower = s.toLowerCase();
  if (lower === 'critical') return 'critical';
  if (lower === 'high') return 'high';
  if (lower === 'medium') return 'medium';
  return 'low';
}

function earthquakeSeverity(magnitude: number): Severity {
  if (magnitude >= 7) return 'critical';
  if (magnitude >= 6) return 'high';
  if (magnitude >= 5) return 'medium';
  if (magnitude >= 4) return 'low';
  return 'info';
}

function ciiSeverity(score: number): Severity {
  if (score >= 81) return 'critical';
  if (score >= 66) return 'high';
  if (score >= 51) return 'medium';
  if (score >= 31) return 'low';
  return 'info';
}
