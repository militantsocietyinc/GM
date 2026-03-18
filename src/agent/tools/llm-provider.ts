/**
 * LLM Provider Tools — wraps the unified LLM provider for the agent pipeline.
 *
 * Provides classification, briefing, and synthesis capabilities as
 * agent tools. Uses local Llama (via Ollama) as primary provider
 * with automatic cloud fallback.
 *
 * Tools:
 *   llm.classify   — Classify a headline into threat level + category
 *   llm.brief      — Generate a country intelligence brief
 *   llm.synthesize — Synthesize multiple signals into a narrative
 */

import type { Signal, Severity } from '../types';
import { registerTool, createSignal } from './registry';

// ============================================================================
// TOOL: LLM Classification
// ============================================================================

registerTool({
  id: 'llm.classify',
  name: 'LLM Event Classifier',
  description: 'Classifies headlines into threat level and category using local Llama model',
  domains: ['intelligence'],
  inputSchema: {
    type: 'object',
    properties: {
      headlines: { type: 'array', items: { type: 'string' }, description: 'Headlines to classify' },
    },
  },
  outputDomain: 'intelligence',
  concurrency: 3,
  timeout: 60_000,
  async execute(input) {
    const { IntelligenceServiceClient } = await import(
      '@/generated/client/worldmonitor/intelligence/v1/service_client'
    );
    const client = new IntelligenceServiceClient('', {
      fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
    });

    const headlines = (input.headlines as string[]) ?? [];
    const signals: Signal[] = [];

    for (const headline of headlines.slice(0, 20)) {
      try {
        const resp = await client.classifyEvent({ title: headline, description: '', source: '', country: '' });
        if (!resp.classification) continue;

        const severity = mapClassificationSeverity(resp.classification.subcategory ?? '');

        signals.push(createSignal('intelligence', {
          sourceId: `classify-${headline.slice(0, 30)}`,
          severity,
          regions: [],
          timestamp: Date.now(),
          payload: {
            type: 'classification',
            headline,
            level: resp.classification.subcategory,
            category: resp.classification.category,
            confidence: resp.classification.confidence,
          },
          confidence: resp.classification.confidence ?? 0.8,
          tags: ['llm', 'classification', resp.classification.category ?? ''],
          provenance: 'tool:llm.classify',
        }));
      } catch {
        // Individual classification failures are non-fatal
      }
    }

    return signals;
  },
});

// ============================================================================
// TOOL: Country Intelligence Brief
// ============================================================================

registerTool({
  id: 'llm.brief',
  name: 'Country Intelligence Brief',
  description: 'Generates an intelligence brief for a country using local Llama model',
  domains: ['intelligence'],
  inputSchema: {
    type: 'object',
    properties: {
      countryCode: { type: 'string', description: 'ISO 2-letter country code' },
    },
  },
  outputDomain: 'intelligence',
  concurrency: 2,
  timeout: 45_000,
  async execute(input) {
    const { IntelligenceServiceClient } = await import(
      '@/generated/client/worldmonitor/intelligence/v1/service_client'
    );
    const client = new IntelligenceServiceClient('', {
      fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
    });

    const countryCode = (input.countryCode as string) ?? 'US';

    try {
      const resp = await client.getCountryIntelBrief({ countryCode });
      if (!resp.brief) return [];

      return [createSignal('intelligence', {
        sourceId: `brief-${countryCode}`,
        severity: 'medium',
        regions: [countryCode],
        timestamp: Date.now(),
        payload: {
          type: 'intel_brief',
          countryCode,
          countryName: resp.countryName,
          brief: resp.brief,
          model: resp.model,
        },
        confidence: 0.85,
        tags: ['llm', 'brief', countryCode.toLowerCase()],
        provenance: 'tool:llm.brief',
      })];
    } catch {
      return [];
    }
  },
});

// ============================================================================
// TOOL: Signal Synthesis (narrative generation from collapsed signals)
// ============================================================================

registerTool({
  id: 'llm.synthesize',
  name: 'Signal Narrative Synthesizer',
  description: 'Generates narrative synthesis from collapsed signal data using local Llama',
  domains: ['intelligence'],
  inputSchema: {
    type: 'object',
    properties: {
      findings: { type: 'array', description: 'Finding summaries to synthesize' },
      focalPoints: { type: 'array', description: 'Focal point entities' },
    },
  },
  outputDomain: 'intelligence',
  concurrency: 1,
  timeout: 60_000,
  async execute(input) {
    const { NewsServiceClient } = await import(
      '@/generated/client/worldmonitor/news/v1/service_client'
    );
    const client = new NewsServiceClient('', {
      fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
    });

    const findings = (input.findings as string[]) ?? [];
    const focalPoints = (input.focalPoints as string[]) ?? [];

    if (findings.length === 0) return [];

    // Use summarize endpoint with analysis mode
    const headlines = findings.slice(0, 8);
    const geoContext = focalPoints.length > 0
      ? `Active focal points: ${focalPoints.join(', ')}`
      : '';

    try {
      const resp = await client.summarizeArticle({
        provider: 'ollama',
        headlines,
        mode: 'analysis',
        geoContext,
        variant: 'full',
        lang: 'en',
      });

      if (!resp.summary) return [];

      return [createSignal('intelligence', {
        sourceId: `synthesis-${Date.now()}`,
        severity: 'medium',
        regions: [],
        timestamp: Date.now(),
        payload: {
          type: 'synthesis',
          narrative: resp.summary,
          model: resp.model,
          provider: resp.provider,
          inputFindings: findings.length,
          inputFocalPoints: focalPoints.length,
        },
        confidence: 0.75,
        tags: ['llm', 'synthesis', 'narrative'],
        provenance: 'tool:llm.synthesize',
      })];
    } catch {
      return [];
    }
  },
});

// ============================================================================
// HELPERS
// ============================================================================

function mapClassificationSeverity(level: string): Severity {
  if (level === 'critical') return 'critical';
  if (level === 'high') return 'high';
  if (level === 'medium') return 'medium';
  if (level === 'low') return 'low';
  return 'info';
}
