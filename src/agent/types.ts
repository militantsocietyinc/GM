/**
 * Agent Planning System — Core Type Definitions
 *
 * A purpose-built intelligence orchestration runtime that replaces
 * monolithic service orchestration with typed pipelines, invariant
 * verification, cascade collapse, and an agent planning loop.
 *
 * Architecture: INGEST → ENCODE → FILTER → COLLAPSE → SYNTHESIZE → EMIT
 */

// ============================================================================
// SIGNAL PRIMITIVES
// ============================================================================

/** Every signal in the system carries a domain tag */
export type SignalDomain =
  | 'news'
  | 'conflict'
  | 'unrest'
  | 'military'
  | 'maritime'
  | 'cyber'
  | 'economic'
  | 'climate'
  | 'infrastructure'
  | 'seismology'
  | 'wildfire'
  | 'displacement'
  | 'aviation'
  | 'prediction'
  | 'intelligence';

export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type TrendDirection = 'rising' | 'stable' | 'falling';

/** Canonical signal — the atom of the system */
export interface Signal<T = unknown> {
  /** Unique identifier (domain:source:hash) */
  id: string;
  /** Which domain produced this signal */
  domain: SignalDomain;
  /** Severity assessment */
  severity: Severity;
  /** ISO country codes this signal relates to */
  regions: string[];
  /** When the signal was created */
  timestamp: number;
  /** When the signal entered the pipeline */
  ingestedAt: number;
  /** Geolocation if available */
  geo?: { lat: number; lon: number };
  /** Typed payload */
  payload: T;
  /** Confidence in the signal's validity (0-1) */
  confidence: number;
  /** Provenance chain — which tools/stages produced this */
  provenance: string[];
  /** Tags for filtering */
  tags: string[];
}

/** A signal that has been through the ENCODE stage */
export interface EncodedSignal<T = unknown> extends Signal<T> {
  /** Normalized score (0-100) for cross-domain comparison */
  normalizedScore: number;
  /** Feature vector for similarity computation */
  features: number[];
  /** Canonical encoding timestamp */
  encodedAt: number;
}

/** A signal group after COLLAPSE — multiple signals merged */
export interface CollapsedSignal {
  /** Composite ID */
  id: string;
  /** All signals that collapsed into this */
  sources: EncodedSignal[];
  /** Collapsed severity (highest of sources) */
  severity: Severity;
  /** Union of all regions */
  regions: string[];
  /** Composite score after cascade normalization */
  compositeScore: number;
  /** Number of distinct domains contributing */
  domainBreadth: number;
  /** The collapse rule that triggered this */
  collapseRule: string;
  /** Timestamp of collapse */
  collapsedAt: number;
  /** Narrative synthesis of contributing signals */
  synthesis?: string;
}

// ============================================================================
// PIPELINE STAGES
// ============================================================================

export enum PipelineStage {
  INGEST = 'INGEST',
  ENCODE = 'ENCODE',
  FILTER = 'FILTER',
  COLLAPSE = 'COLLAPSE',
  SYNTHESIZE = 'SYNTHESIZE',
  EMIT = 'EMIT',
}

export interface StageResult<T> {
  stage: PipelineStage;
  input: unknown;
  output: T;
  duration: number;
  invariantsPassed: string[];
  invariantsFailed: InvariantViolation[];
  droppedCount: number;
}

export interface PipelineContext {
  /** Unique pipeline run ID */
  runId: string;
  /** When this run started */
  startedAt: number;
  /** Stage results accumulated so far */
  stages: StageResult<unknown>[];
  /** Current memory snapshot for the agent */
  memory: MemorySnapshot;
  /** Active goals being pursued */
  goals: Goal[];
}

// ============================================================================
// INVARIANT VERIFICATION
// ============================================================================

export type InvariantSeverity = 'fatal' | 'error' | 'warning' | 'info';

export type InvariantCategory =
  | 'structural'   // Data shape and required fields
  | 'temporal'     // Time ordering and freshness
  | 'consistency'  // Cross-signal logical consistency
  | 'coverage'     // Minimum domain coverage
  | 'pipeline';    // Stage ordering and completeness

export interface Invariant {
  /** Unique rule ID (e.g., "S-001") */
  id: string;
  /** Human-readable name */
  name: string;
  /** Which category */
  category: InvariantCategory;
  /** How bad is a violation */
  severity: InvariantSeverity;
  /** Which pipeline stage(s) this applies to */
  stages: PipelineStage[];
  /** The check function — returns null if passed, violation if failed */
  check: (ctx: InvariantCheckContext) => InvariantViolation | null;
}

export interface InvariantCheckContext {
  stage: PipelineStage;
  signals: Signal[];
  encoded?: EncodedSignal[];
  collapsed?: CollapsedSignal[];
  pipeline: PipelineContext;
}

export interface InvariantViolation {
  invariantId: string;
  severity: InvariantSeverity;
  message: string;
  details?: Record<string, unknown>;
  /** Should pipeline halt? Only 'fatal' causes halt by default */
  halt: boolean;
}

// ============================================================================
// CASCADE COLLAPSE
// ============================================================================

/** Rule that determines when signals should merge */
export interface CollapseRule {
  id: string;
  name: string;
  /** Minimum signals required to trigger */
  minSignals: number;
  /** Maximum time window for signals to be considered related (ms) */
  timeWindow: number;
  /** Required domain overlap */
  requiredDomains?: SignalDomain[];
  /** Minimum domain breadth to trigger */
  minDomainBreadth?: number;
  /** Geographic proximity threshold (km) */
  geoRadiusKm?: number;
  /** Region must match */
  regionMatch: boolean;
  /** Score boost factor when this rule fires */
  boostFactor: number;
  /** Priority for conflict resolution */
  priority: number;
}

// ============================================================================
// EVENT BUS
// ============================================================================

export type BusEventType =
  | 'signal:ingested'
  | 'signal:encoded'
  | 'signal:filtered'
  | 'signal:collapsed'
  | 'signal:synthesized'
  | 'signal:emitted'
  | 'pipeline:started'
  | 'pipeline:stage:complete'
  | 'pipeline:complete'
  | 'pipeline:error'
  | 'invariant:violation'
  | 'goal:created'
  | 'goal:completed'
  | 'goal:failed'
  | 'task:queued'
  | 'task:started'
  | 'task:completed'
  | 'memory:updated'
  | 'agent:observe'
  | 'agent:plan'
  | 'agent:act'
  | 'agent:reflect';

export interface BusEvent<T = unknown> {
  type: BusEventType;
  payload: T;
  timestamp: number;
  source: string;
}

export type BusHandler<T = unknown> = (event: BusEvent<T>) => void | Promise<void>;

// ============================================================================
// AGENT RUNTIME
// ============================================================================

export type AgentPhase = 'observe' | 'plan' | 'act' | 'reflect' | 'idle';

export interface AgentState {
  phase: AgentPhase;
  cycleCount: number;
  lastCycleAt: number;
  activeGoals: Goal[];
  taskQueue: Task[];
  observations: Observation[];
  reflections: Reflection[];
}

export interface Observation {
  id: string;
  timestamp: number;
  /** What was observed */
  summary: string;
  /** Collapsed signals that triggered this observation */
  signals: CollapsedSignal[];
  /** Salience score (0-100) — how important is this? */
  salience: number;
  /** Does this warrant a new goal? */
  actionable: boolean;
}

export interface Reflection {
  id: string;
  timestamp: number;
  /** What the agent learned */
  insight: string;
  /** Which goals/tasks this relates to */
  context: string[];
  /** Should this be stored in long-term memory? */
  persist: boolean;
}

// ============================================================================
// GOAL & TASK DECOMPOSITION
// ============================================================================

export type GoalStatus = 'active' | 'completed' | 'failed' | 'suspended';
export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'blocked';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export interface Goal {
  id: string;
  /** What the agent is trying to achieve */
  objective: string;
  /** Why this goal exists */
  rationale: string;
  status: GoalStatus;
  /** Priority (0 = highest) */
  priority: number;
  /** Decomposed tasks */
  tasks: Task[];
  /** When created */
  createdAt: number;
  /** When completed/failed */
  resolvedAt?: number;
  /** Success criteria */
  successCriteria: string[];
  /** Parent goal ID if this is a sub-goal */
  parentId?: string;
}

export interface Task {
  id: string;
  goalId: string;
  /** What to do */
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  /** Which tool to invoke */
  toolId: string;
  /** Tool input parameters */
  toolInput: Record<string, unknown>;
  /** Dependencies — task IDs that must complete first */
  dependencies: string[];
  /** Result from execution */
  result?: TaskResult;
  /** When queued */
  queuedAt: number;
  /** When started */
  startedAt?: number;
  /** When finished */
  completedAt?: number;
  /** Max retries */
  maxRetries: number;
  /** Current retry count */
  retryCount: number;
}

export interface TaskResult {
  success: boolean;
  output: unknown;
  error?: string;
  duration: number;
}

// ============================================================================
// TOOL REGISTRY
// ============================================================================

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  /** Which domains this tool serves */
  domains: SignalDomain[];
  /** Input schema (JSON Schema subset) */
  inputSchema: Record<string, unknown>;
  /** Output signal domain */
  outputDomain: SignalDomain;
  /** Max concurrent invocations */
  concurrency: number;
  /** Timeout in ms */
  timeout: number;
  /** The execution function */
  execute: (input: Record<string, unknown>) => Promise<Signal[]>;
}

// ============================================================================
// MEMORY SYSTEM
// ============================================================================

export type MemoryType = 'session' | 'episodic' | 'longterm';

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  /** What to remember */
  content: string;
  /** Structured data */
  data?: Record<string, unknown>;
  /** Relevance tags */
  tags: string[];
  /** Region association */
  regions: string[];
  /** When stored */
  storedAt: number;
  /** When last accessed */
  lastAccessedAt: number;
  /** Access count — for decay/promotion */
  accessCount: number;
  /** Importance score (0-100) */
  importance: number;
}

export interface MemorySnapshot {
  session: MemoryEntry[];
  episodic: MemoryEntry[];
  longterm: MemoryEntry[];
  /** Total entries across all stores */
  totalEntries: number;
  /** Last compaction timestamp */
  lastCompactedAt: number;
}

// ============================================================================
// SYNTHESIS OUTPUT
// ============================================================================

export interface IntelligenceBrief {
  id: string;
  timestamp: number;
  /** Overall threat level */
  threatLevel: Severity;
  /** Key findings */
  findings: Finding[];
  /** Active focal points */
  focalPoints: FocalPointBrief[];
  /** Recommendations */
  recommendations: string[];
  /** Pipeline run that produced this */
  pipelineRunId: string;
  /** How many signals contributed */
  signalCount: number;
  /** Domain coverage */
  domainsCovered: SignalDomain[];
}

export interface Finding {
  id: string;
  title: string;
  severity: Severity;
  regions: string[];
  domains: SignalDomain[];
  summary: string;
  /** Source collapsed signal IDs */
  sourceSignals: string[];
  confidence: number;
}

export interface FocalPointBrief {
  entity: string;
  entityType: 'country' | 'organization' | 'person' | 'infrastructure';
  /** Cross-domain signal convergence score */
  convergenceScore: number;
  /** Domains with active signals */
  activeDomains: SignalDomain[];
  /** Headline narrative */
  narrative: string;
  trend: TrendDirection;
}
