/**
 * Tool Registry — typed tool definitions wrapping existing services.
 *
 * Each tool converts existing WorldMonitor service calls into the
 * canonical Signal format for the agent pipeline. The registry
 * provides discovery, validation, and concurrency control.
 */

import type { ToolDefinition, Signal, SignalDomain, Severity } from '../types';

// ============================================================================
// TOOL REGISTRY
// ============================================================================

const tools = new Map<string, ToolDefinition>();

export function registerTool(tool: ToolDefinition): void {
  if (tools.has(tool.id)) {
    throw new Error(`Tool "${tool.id}" already registered`);
  }
  tools.set(tool.id, tool);
}

export function getTool(id: string): ToolDefinition | undefined {
  return tools.get(id);
}

export function getAllTools(): ToolDefinition[] {
  return [...tools.values()];
}

export function getToolsByDomain(domain: SignalDomain): ToolDefinition[] {
  return [...tools.values()].filter(t => t.domains.includes(domain));
}

// ============================================================================
// TOOL EXECUTION WITH CONCURRENCY CONTROL
// ============================================================================

const activeExecutions = new Map<string, number>();

export async function executeTool(
  toolId: string,
  input: Record<string, unknown>,
): Promise<Signal[]> {
  const tool = tools.get(toolId);
  if (!tool) throw new Error(`Unknown tool: ${toolId}`);

  const active = activeExecutions.get(toolId) ?? 0;
  if (active >= tool.concurrency) {
    throw new Error(`Tool "${toolId}" at max concurrency (${tool.concurrency})`);
  }

  activeExecutions.set(toolId, active + 1);

  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Tool "${toolId}" timed out after ${tool.timeout}ms`)), tool.timeout)
    );

    const result = await Promise.race([
      tool.execute(input),
      timeoutPromise,
    ]);

    return result;
  } finally {
    const current = activeExecutions.get(toolId) ?? 1;
    activeExecutions.set(toolId, Math.max(0, current - 1));
  }
}

// ============================================================================
// SIGNAL FACTORY HELPERS
// ============================================================================

let signalCounter = 0;

export function createSignal(
  domain: SignalDomain,
  opts: {
    sourceId: string;
    severity: Severity;
    regions: string[];
    timestamp: number;
    geo?: { lat: number; lon: number };
    payload: unknown;
    confidence: number;
    tags: string[];
    provenance: string;
  },
): Signal {
  return {
    id: `${domain}:${opts.sourceId}:${++signalCounter}`,
    domain,
    severity: opts.severity,
    regions: opts.regions,
    timestamp: opts.timestamp,
    ingestedAt: Date.now(),
    geo: opts.geo,
    payload: opts.payload,
    confidence: opts.confidence,
    provenance: [opts.provenance],
    tags: opts.tags,
  };
}
