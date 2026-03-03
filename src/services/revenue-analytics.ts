/**
 * Revenue Analytics & Intelligence Engine
 *
 * Comprehensive sales analytics: pipeline snapshots, conversion funnels,
 * rep performance, AI-inspired forecasting, signal ROI analysis,
 * win/loss pattern detection, and automated narrative insights.
 *
 * Data is persisted via the persistent-cache layer (IndexedDB / localStorage / Tauri).
 * To avoid circular dependencies this module does NOT import from deal-pipeline.ts;
 * instead it reads deal data from persistent cache or accepts data via method args.
 */

import { getPersistentCache, setPersistentCache } from './persistent-cache';

// ── Cache Keys ─────────────────────────────────────────────────────────────

const CACHE_KEYS = {
  PIPELINE_SNAPSHOTS: 'revenue-analytics:pipeline-snapshots',
  DEALS: 'revenue-analytics:deals',
  TEAM_MEMBERS: 'revenue-analytics:team-members',
  ACTIVITIES: 'revenue-analytics:activities',
  QUOTAS: 'revenue-analytics:quotas',
} as const;

// ── Constants ──────────────────────────────────────────────────────────────

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_TIMEFRAME_DAYS = 90;
const DEFAULT_HISTORY_DAYS = 90;
const DEFAULT_TREND_DAYS = 30;

// ── Deal Stage Definitions ─────────────────────────────────────────────────

const PIPELINE_STAGES = [
  'prospecting',
  'qualification',
  'discovery',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost',
] as const;

type PipelineStage = typeof PIPELINE_STAGES[number];

const STAGE_ORDER: Record<PipelineStage, number> = {
  prospecting: 0,
  qualification: 1,
  discovery: 2,
  proposal: 3,
  negotiation: 4,
  closed_won: 5,
  closed_lost: 6,
};

const STAGE_WEIGHTS: Record<PipelineStage, number> = {
  prospecting: 0.1,
  qualification: 0.2,
  discovery: 0.4,
  proposal: 0.6,
  negotiation: 0.8,
  closed_won: 1.0,
  closed_lost: 0.0,
};

// ── Persisted Data Types (what we read from cache) ─────────────────────────

interface CachedDeal {
  id: string;
  company: string;
  companyDomain?: string;
  title: string;
  value: number;
  stage: PipelineStage;
  ownerId: string;
  ownerName: string;
  createdAt: string;   // ISO
  updatedAt: string;   // ISO
  closedAt?: string;   // ISO
  expectedCloseDate?: string; // ISO
  outcome?: 'won' | 'lost';
  lossReason?: string;
  signalTypes: string[];
  stageHistory: StageTransition[];
  activities: DealActivity[];
  tags: string[];
}

interface StageTransition {
  from: PipelineStage;
  to: PipelineStage;
  at: string; // ISO
}

interface DealActivity {
  type: 'email' | 'call' | 'meeting' | 'signal' | 'note' | 'task';
  description: string;
  at: string; // ISO
  memberId?: string;
}

interface CachedTeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface CachedActivityLog {
  id: string;
  type: 'email_sent' | 'email_received' | 'call_made' | 'call_received' | 'meeting' | 'signal_processed' | 'note' | 'task_completed';
  at: string; // ISO
  memberId: string;
  dealId?: string;
  description?: string;
}

// ── Public Types ───────────────────────────────────────────────────────────

export interface PipelineSnapshot {
  timestamp: string;     // ISO
  totalDeals: number;
  totalValue: number;
  weightedValue: number;
  byStage: Record<string, { count: number; value: number }>;
  winRate: number;       // 0-1
  avgDealSize: number;
  avgCycleLength: number; // days
}

export interface ConversionFunnel {
  stages: FunnelStage[];
  overallConversionRate: number; // 0-1
  bottleneck: string;            // stage name
  timeframe: number;             // days
}

export interface FunnelStage {
  name: string;
  entered: number;
  exited: number;
  converted: number;
  dropped: number;
  conversionRate: number;  // 0-1
  avgDaysInStage: number;
}

export interface RepPerformance {
  memberId: string;
  memberName: string;
  dealsWon: number;
  dealsLost: number;
  revenue: number;
  quota?: number;
  attainment?: number;     // 0-1+
  avgDealSize: number;
  avgCycleLength: number;  // days
  winRate: number;          // 0-1
  topSignalTypes: string[]; // which signals led to wins
}

export interface ForecastModel {
  period: string;          // e.g. 'Q1 2026'
  bestCase: number;
  committed: number;
  expected: number;
  worstCase: number;
  pipeline: number;
  gap: number;             // quota - expected
  confidence: number;      // 0-1
}

export interface SignalROI {
  signalType: string;
  dealsInfluenced: number;
  revenueInfluenced: number;
  avgDealSize: number;
  conversionRate: number;  // 0-1
  avgDaysToClose: number;
}

export interface TrendDataPoint {
  date: string;   // ISO date string (YYYY-MM-DD)
  value: number;
  label?: string;
}

export interface DealVelocityStage {
  stage: string;
  avgDays: number;
  medianDays: number;
  trend: 'accelerating' | 'stable' | 'decelerating';
}

export interface DealVelocityReport {
  stages: DealVelocityStage[];
  overallAvgDays: number;
  overallMedianDays: number;
  trend: 'accelerating' | 'stable' | 'decelerating';
}

export interface WinLossPattern {
  pattern: string;
  frequency: number;       // how many deals matched
  percentage: number;       // 0-100
  exampleDeals: string[];  // deal titles
}

export interface ActivityMetrics {
  timeframeDays: number;
  emailsSent: number;
  emailsReceived: number;
  callsMade: number;
  callsReceived: number;
  meetings: number;
  signalsProcessed: number;
  notes: number;
  tasksCompleted: number;
  totalActivities: number;
  activitiesPerDeal: number;
  activitiesPerDay: number;
}

export interface ExecutiveSummary {
  pipelineValue: number;
  weightedPipeline: number;
  forecast: ForecastModel | null;
  winRate: number;
  avgDealSize: number;
  avgCycleLength: number;
  totalDeals: number;
  dealsWonThisPeriod: number;
  revenueThisPeriod: number;
  topSignals: string[];
  velocity: DealVelocityReport;
  insights: string[];
}

// ── Utility helpers ────────────────────────────────────────────────────────

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / MS_PER_DAY;
}

function isWithinDays(isoDate: string, days: number): boolean {
  const cutoff = Date.now() - days * MS_PER_DAY;
  return new Date(isoDate).getTime() >= cutoff;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]!
    : ((sorted[mid - 1]! + sorted[mid]!) / 2);
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function currentQuarter(): string {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `Q${q} ${now.getFullYear()}`;
}

function quarterStart(): Date {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3);
  return new Date(now.getFullYear(), q * 3, 1);
}

function safeDiv(numerator: number, denominator: number, fallback = 0): number {
  return denominator > 0 ? numerator / denominator : fallback;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Revenue Analytics Engine ───────────────────────────────────────────────

class RevenueAnalyticsEngine {
  private static _instance: RevenueAnalyticsEngine | null = null;

  // In-memory caches for the current session
  private dealCache: CachedDeal[] | null = null;
  private teamCache: CachedTeamMember[] | null = null;
  private activityCache: CachedActivityLog[] | null = null;

  constructor() {
    if (RevenueAnalyticsEngine._instance) {
      return RevenueAnalyticsEngine._instance;
    }
    RevenueAnalyticsEngine._instance = this;
  }

  // ── Data Loading ─────────────────────────────────────────────────────

  private async loadDeals(): Promise<CachedDeal[]> {
    if (this.dealCache) return this.dealCache;
    const envelope = await getPersistentCache<CachedDeal[]>(CACHE_KEYS.DEALS);
    this.dealCache = envelope?.data ?? [];
    return this.dealCache;
  }

  private async loadTeam(): Promise<CachedTeamMember[]> {
    if (this.teamCache) return this.teamCache;
    const envelope = await getPersistentCache<CachedTeamMember[]>(CACHE_KEYS.TEAM_MEMBERS);
    this.teamCache = envelope?.data ?? [];
    return this.teamCache;
  }

  private async loadActivities(): Promise<CachedActivityLog[]> {
    if (this.activityCache) return this.activityCache;
    const envelope = await getPersistentCache<CachedActivityLog[]>(CACHE_KEYS.ACTIVITIES);
    this.activityCache = envelope?.data ?? [];
    return this.activityCache;
  }

  private async loadSnapshots(): Promise<PipelineSnapshot[]> {
    const envelope = await getPersistentCache<PipelineSnapshot[]>(CACHE_KEYS.PIPELINE_SNAPSHOTS);
    return envelope?.data ?? [];
  }

  private async loadQuotas(): Promise<Record<string, number>> {
    const envelope = await getPersistentCache<Record<string, number>>(CACHE_KEYS.QUOTAS);
    return envelope?.data ?? {};
  }

  /** Invalidate in-memory caches (call after external data mutation). */
  invalidateCache(): void {
    this.dealCache = null;
    this.teamCache = null;
    this.activityCache = null;
  }

  // ── Pipeline Snapshots ───────────────────────────────────────────────

  /**
   * Capture the current pipeline state and persist it for historical tracking.
   */
  async takePipelineSnapshot(): Promise<PipelineSnapshot> {
    const deals = await this.loadDeals();
    const now = new Date().toISOString();

    const openDeals = deals.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost');
    const wonDeals = deals.filter(d => d.outcome === 'won');
    const lostDeals = deals.filter(d => d.outcome === 'lost');

    const totalValue = openDeals.reduce((sum, d) => sum + d.value, 0);
    const weightedValue = openDeals.reduce(
      (sum, d) => sum + d.value * (STAGE_WEIGHTS[d.stage] ?? 0),
      0,
    );

    const byStage: Record<string, { count: number; value: number }> = {};
    for (const stage of PIPELINE_STAGES) {
      const stageDeals = deals.filter(d => d.stage === stage);
      byStage[stage] = {
        count: stageDeals.length,
        value: stageDeals.reduce((s, d) => s + d.value, 0),
      };
    }

    const closedTotal = wonDeals.length + lostDeals.length;
    const winRate = safeDiv(wonDeals.length, closedTotal);

    const wonValues = wonDeals.map(d => d.value);
    const avgDealSize = safeDiv(
      wonValues.reduce((s, v) => s + v, 0),
      wonValues.length,
    );

    const cycleLengths = wonDeals
      .filter(d => d.closedAt)
      .map(d => daysBetween(d.createdAt, d.closedAt!));
    const avgCycleLength = safeDiv(
      cycleLengths.reduce((s, v) => s + v, 0),
      cycleLengths.length,
    );

    const snapshot: PipelineSnapshot = {
      timestamp: now,
      totalDeals: openDeals.length,
      totalValue: round2(totalValue),
      weightedValue: round2(weightedValue),
      byStage,
      winRate: round2(winRate),
      avgDealSize: round2(avgDealSize),
      avgCycleLength: round2(avgCycleLength),
    };

    // Persist to history
    const history = await this.loadSnapshots();
    history.push(snapshot);

    // Keep at most 365 snapshots (one per day for a year)
    const trimmed = history.length > 365 ? history.slice(history.length - 365) : history;
    await setPersistentCache(CACHE_KEYS.PIPELINE_SNAPSHOTS, trimmed);

    return snapshot;
  }

  /**
   * Return historical pipeline snapshots within the given window.
   */
  async getPipelineHistory(days: number = DEFAULT_HISTORY_DAYS): Promise<PipelineSnapshot[]> {
    const snapshots = await this.loadSnapshots();
    const cutoff = Date.now() - days * MS_PER_DAY;
    return snapshots.filter(s => new Date(s.timestamp).getTime() >= cutoff);
  }

  // ── Conversion Funnel ────────────────────────────────────────────────

  /**
   * Full funnel analysis with stage-by-stage conversion rates.
   */
  async getConversionFunnel(timeframeDays: number = DEFAULT_TIMEFRAME_DAYS): Promise<ConversionFunnel> {
    const deals = await this.loadDeals();
    const relevantDeals = deals.filter(d => isWithinDays(d.createdAt, timeframeDays));

    // Active (non-terminal) stages for the funnel
    const funnelStages: PipelineStage[] = [
      'prospecting',
      'qualification',
      'discovery',
      'proposal',
      'negotiation',
    ];

    const stages: FunnelStage[] = funnelStages.map((stageName, idx) => {
      // Deals that entered this stage (created at or passed through it)
      const entered = relevantDeals.filter(d => {
        const dealStageOrder = STAGE_ORDER[d.stage];
        const currentStageOrder = STAGE_ORDER[stageName];
        // Deal entered this stage if it's currently at or past this stage
        const passedThrough = d.stageHistory.some(t => t.to === stageName || t.from === stageName);
        return dealStageOrder >= currentStageOrder || passedThrough;
      }).length;

      // Deals that moved to the next stage
      const nextStage = funnelStages[idx + 1];
      const converted = nextStage
        ? relevantDeals.filter(d => {
            const dealStageOrder = STAGE_ORDER[d.stage];
            const nextStageOrder = STAGE_ORDER[nextStage];
            return dealStageOrder >= nextStageOrder;
          }).length
        : relevantDeals.filter(d => d.outcome === 'won').length;

      // Deals that exited (moved forward or dropped)
      const exited = relevantDeals.filter(d => {
        const passedThrough = d.stageHistory.some(t => t.from === stageName);
        return passedThrough || (d.stage !== stageName);
      }).length;

      // Deals that dropped (went to closed_lost from this stage or stalled)
      const dropped = relevantDeals.filter(d => {
        return d.outcome === 'lost' && d.stageHistory.some(
          t => t.from === stageName && t.to === 'closed_lost',
        );
      }).length;

      const conversionRate = safeDiv(converted, entered);

      // Avg days in this stage
      const daysInStage = relevantDeals
        .filter(d => {
          const entryTransition = d.stageHistory.find(t => t.to === stageName);
          const exitTransition = d.stageHistory.find(t => t.from === stageName);
          return entryTransition && exitTransition;
        })
        .map(d => {
          const entry = d.stageHistory.find(t => t.to === stageName)!;
          const exit = d.stageHistory.find(t => t.from === stageName)!;
          return daysBetween(entry.at, exit.at);
        });

      const avgDaysInStage = safeDiv(
        daysInStage.reduce((s, v) => s + v, 0),
        daysInStage.length,
      );

      return {
        name: stageName,
        entered,
        exited,
        converted,
        dropped,
        conversionRate: round2(conversionRate),
        avgDaysInStage: round2(avgDaysInStage),
      };
    });

    // Overall conversion: prospecting -> closed_won
    const totalEntered = stages[0]?.entered ?? 0;
    const totalWon = relevantDeals.filter(d => d.outcome === 'won').length;
    const overallConversionRate = round2(safeDiv(totalWon, totalEntered));

    // Bottleneck: stage with the lowest conversion rate (excluding zero-entered stages)
    const bottleneckStage = stages
      .filter(s => s.entered > 0)
      .sort((a, b) => a.conversionRate - b.conversionRate)[0];
    const bottleneck = bottleneckStage?.name ?? 'unknown';

    return {
      stages,
      overallConversionRate,
      bottleneck,
      timeframe: timeframeDays,
    };
  }

  // ── Rep Performance ──────────────────────────────────────────────────

  /**
   * Ranked rep performance leaderboard, sorted by revenue descending.
   */
  async getRepLeaderboard(): Promise<RepPerformance[]> {
    const deals = await this.loadDeals();
    const team = await this.loadTeam();
    const quotas = await this.loadQuotas();

    const ownerIds = new Set(deals.map(d => d.ownerId));

    const performances: RepPerformance[] = [];

    for (const memberId of ownerIds) {
      const memberDeals = deals.filter(d => d.ownerId === memberId);
      const member = team.find(m => m.id === memberId);
      const memberName = member?.name ?? memberDeals[0]?.ownerName ?? 'Unknown';

      const won = memberDeals.filter(d => d.outcome === 'won');
      const lost = memberDeals.filter(d => d.outcome === 'lost');
      const revenue = won.reduce((s, d) => s + d.value, 0);

      const quota = quotas[memberId];
      const attainment = quota !== undefined && quota > 0
        ? round2(revenue / quota)
        : undefined;

      const avgDealSize = safeDiv(revenue, won.length);

      const cycleLengths = won
        .filter(d => d.closedAt)
        .map(d => daysBetween(d.createdAt, d.closedAt!));
      const avgCycleLength = safeDiv(
        cycleLengths.reduce((s, v) => s + v, 0),
        cycleLengths.length,
      );

      const closedTotal = won.length + lost.length;
      const winRate = safeDiv(won.length, closedTotal);

      // Determine which signal types led to wins
      const signalCounts = new Map<string, number>();
      for (const deal of won) {
        for (const sig of deal.signalTypes) {
          signalCounts.set(sig, (signalCounts.get(sig) ?? 0) + 1);
        }
      }
      const topSignalTypes = [...signalCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([type]) => type);

      performances.push({
        memberId,
        memberName,
        dealsWon: won.length,
        dealsLost: lost.length,
        revenue: round2(revenue),
        quota,
        attainment,
        avgDealSize: round2(avgDealSize),
        avgCycleLength: round2(avgCycleLength),
        winRate: round2(winRate),
        topSignalTypes,
      });
    }

    return performances.sort((a, b) => b.revenue - a.revenue);
  }

  /**
   * Detailed metrics for a single rep.
   */
  async getRepPerformance(memberId: string): Promise<RepPerformance | null> {
    const leaderboard = await this.getRepLeaderboard();
    return leaderboard.find(r => r.memberId === memberId) ?? null;
  }

  // ── Forecasting ──────────────────────────────────────────────────────

  /**
   * AI-inspired revenue forecast using deal stage weights, historical
   * win rates, and pipeline coverage ratios.
   *
   * @param quotas Optional map of memberId -> quota. If omitted, reads from cache.
   */
  async generateForecast(quotas?: Record<string, number>): Promise<ForecastModel> {
    const deals = await this.loadDeals();
    const resolvedQuotas = quotas ?? await this.loadQuotas();
    const period = currentQuarter();
    const qStart = quarterStart();

    const openDeals = deals.filter(
      d => d.stage !== 'closed_won' && d.stage !== 'closed_lost',
    );
    const wonThisQ = deals.filter(
      d => d.outcome === 'won' && d.closedAt && new Date(d.closedAt) >= qStart,
    );

    const closedDeals = deals.filter(d => d.outcome === 'won' || d.outcome === 'lost');
    const historicalWinRate = safeDiv(
      closedDeals.filter(d => d.outcome === 'won').length,
      closedDeals.length,
      0.3, // conservative default
    );

    const alreadyWon = wonThisQ.reduce((s, d) => s + d.value, 0);
    const pipelineTotal = openDeals.reduce((s, d) => s + d.value, 0);

    // Stage-weighted pipeline
    const weightedPipeline = openDeals.reduce(
      (sum, d) => sum + d.value * (STAGE_WEIGHTS[d.stage] ?? 0),
      0,
    );

    // Committed: deals in negotiation or proposal stage (high probability)
    const committedDeals = openDeals.filter(
      d => d.stage === 'negotiation' || d.stage === 'proposal',
    );
    const committed = round2(
      alreadyWon + committedDeals.reduce((s, d) => s + d.value * (STAGE_WEIGHTS[d.stage] ?? 0), 0),
    );

    // Expected: weighted pipeline adjusted by historical win rate
    const expected = round2(alreadyWon + weightedPipeline * historicalWinRate);

    // Best case: already won + full weighted pipeline with optimistic multiplier
    const bestCase = round2(alreadyWon + weightedPipeline * Math.min(1, historicalWinRate * 1.4));

    // Worst case: already won + only negotiation-stage deals at reduced rate
    const negotiationOnly = openDeals
      .filter(d => d.stage === 'negotiation')
      .reduce((s, d) => s + d.value, 0);
    const worstCase = round2(alreadyWon + negotiationOnly * historicalWinRate * 0.7);

    // Total team quota
    const totalQuota = Object.values(resolvedQuotas).reduce((s, q) => s + q, 0);

    const gap = round2(totalQuota - expected);

    // Confidence based on pipeline coverage ratio and data quality
    const coverageRatio = safeDiv(pipelineTotal, totalQuota, 1);
    const dataQuality = Math.min(1, closedDeals.length / 20); // need ~20 closed deals for high confidence
    const confidence = round2(Math.min(1, coverageRatio * 0.5 + dataQuality * 0.5));

    return {
      period,
      bestCase,
      committed,
      expected,
      worstCase,
      pipeline: round2(pipelineTotal),
      gap,
      confidence,
    };
  }

  // ── Signal ROI Analysis ──────────────────────────────────────────────

  /**
   * Analyze which signal types produce the highest ROI in terms of
   * deals influenced, revenue, and conversion speed.
   */
  async getSignalROI(): Promise<SignalROI[]> {
    const deals = await this.loadDeals();

    // Group deals by signal type
    const signalMap = new Map<string, { influenced: CachedDeal[]; won: CachedDeal[] }>();

    for (const deal of deals) {
      for (const sig of deal.signalTypes) {
        const entry = signalMap.get(sig) ?? { influenced: [], won: [] };
        entry.influenced.push(deal);
        if (deal.outcome === 'won') {
          entry.won.push(deal);
        }
        signalMap.set(sig, entry);
      }
    }

    const results: SignalROI[] = [];

    for (const [signalType, data] of signalMap) {
      const revenueInfluenced = data.won.reduce((s, d) => s + d.value, 0);
      const avgDealSize = safeDiv(revenueInfluenced, data.won.length);
      const conversionRate = safeDiv(data.won.length, data.influenced.length);

      const cycleLengths = data.won
        .filter(d => d.closedAt)
        .map(d => daysBetween(d.createdAt, d.closedAt!));
      const avgDaysToClose = safeDiv(
        cycleLengths.reduce((s, v) => s + v, 0),
        cycleLengths.length,
      );

      results.push({
        signalType,
        dealsInfluenced: data.influenced.length,
        revenueInfluenced: round2(revenueInfluenced),
        avgDealSize: round2(avgDealSize),
        conversionRate: round2(conversionRate),
        avgDaysToClose: round2(avgDaysToClose),
      });
    }

    return results.sort((a, b) => b.revenueInfluenced - a.revenueInfluenced);
  }

  // ── Win / Loss Patterns ──────────────────────────────────────────────

  /**
   * Common characteristics of won deals: signal patterns, timing, approach.
   */
  async getWinPatterns(): Promise<WinLossPattern[]> {
    const deals = await this.loadDeals();
    const wonDeals = deals.filter(d => d.outcome === 'won');
    if (wonDeals.length === 0) return [];

    return this.extractPatterns(wonDeals, deals.length);
  }

  /**
   * Common characteristics of lost deals.
   */
  async getLossPatterns(): Promise<WinLossPattern[]> {
    const deals = await this.loadDeals();
    const lostDeals = deals.filter(d => d.outcome === 'lost');
    if (lostDeals.length === 0) return [];

    return this.extractPatterns(lostDeals, deals.length);
  }

  private extractPatterns(subset: CachedDeal[], _totalDeals: number): WinLossPattern[] {
    const patterns: WinLossPattern[] = [];

    // Pattern: signal type combinations
    const signalComboCounts = new Map<string, CachedDeal[]>();
    for (const deal of subset) {
      if (deal.signalTypes.length === 0) continue;
      const sorted = [...deal.signalTypes].sort();
      const combo = sorted.join(' + ');
      const existing = signalComboCounts.get(combo) ?? [];
      existing.push(deal);
      signalComboCounts.set(combo, existing);
    }

    for (const [combo, comboDeals] of signalComboCounts) {
      if (comboDeals.length >= 2) {
        patterns.push({
          pattern: `Signal combination: ${combo}`,
          frequency: comboDeals.length,
          percentage: round2((comboDeals.length / subset.length) * 100),
          exampleDeals: comboDeals.slice(0, 3).map(d => d.title),
        });
      }
    }

    // Pattern: high signal count
    const multiSignalDeals = subset.filter(d => d.signalTypes.length >= 3);
    if (multiSignalDeals.length > 0) {
      patterns.push({
        pattern: 'Deals with 3+ signal types',
        frequency: multiSignalDeals.length,
        percentage: round2((multiSignalDeals.length / subset.length) * 100),
        exampleDeals: multiSignalDeals.slice(0, 3).map(d => d.title),
      });
    }

    // Pattern: fast deals (below median cycle length)
    const cycleLengths = subset
      .filter(d => d.closedAt)
      .map(d => ({ deal: d, days: daysBetween(d.createdAt, d.closedAt!) }));
    if (cycleLengths.length > 0) {
      const med = median(cycleLengths.map(c => c.days));
      const fastDeals = cycleLengths.filter(c => c.days <= med * 0.5);
      if (fastDeals.length > 0) {
        patterns.push({
          pattern: `Fast-closing deals (under ${Math.round(med * 0.5)} days)`,
          frequency: fastDeals.length,
          percentage: round2((fastDeals.length / subset.length) * 100),
          exampleDeals: fastDeals.slice(0, 3).map(c => c.deal.title),
        });
      }
    }

    // Pattern: large deals
    const values = subset.map(d => d.value);
    if (values.length > 0) {
      const avgValue = values.reduce((s, v) => s + v, 0) / values.length;
      const largeDeals = subset.filter(d => d.value >= avgValue * 1.5);
      if (largeDeals.length > 0) {
        patterns.push({
          pattern: `Large deals (>= $${Math.round(avgValue * 1.5).toLocaleString()})`,
          frequency: largeDeals.length,
          percentage: round2((largeDeals.length / subset.length) * 100),
          exampleDeals: largeDeals.slice(0, 3).map(d => d.title),
        });
      }
    }

    // Pattern: specific signal types that appear frequently
    const signalFrequency = new Map<string, number>();
    for (const deal of subset) {
      for (const sig of deal.signalTypes) {
        signalFrequency.set(sig, (signalFrequency.get(sig) ?? 0) + 1);
      }
    }
    for (const [sig, count] of signalFrequency) {
      const pct = (count / subset.length) * 100;
      if (pct >= 30 && count >= 2) {
        patterns.push({
          pattern: `${sig} signal present`,
          frequency: count,
          percentage: round2(pct),
          exampleDeals: subset
            .filter(d => d.signalTypes.includes(sig))
            .slice(0, 3)
            .map(d => d.title),
        });
      }
    }

    // Pattern: loss reasons (only for lost deals)
    const lossReasons = new Map<string, CachedDeal[]>();
    for (const deal of subset) {
      if (deal.lossReason) {
        const reason = deal.lossReason.toLowerCase();
        const existing = lossReasons.get(reason) ?? [];
        existing.push(deal);
        lossReasons.set(reason, existing);
      }
    }
    for (const [reason, reasonDeals] of lossReasons) {
      if (reasonDeals.length >= 2) {
        patterns.push({
          pattern: `Loss reason: ${reason}`,
          frequency: reasonDeals.length,
          percentage: round2((reasonDeals.length / subset.length) * 100),
          exampleDeals: reasonDeals.slice(0, 3).map(d => d.title),
        });
      }
    }

    // Pattern: specific tags
    const tagCounts = new Map<string, CachedDeal[]>();
    for (const deal of subset) {
      for (const tag of deal.tags) {
        const existing = tagCounts.get(tag) ?? [];
        existing.push(deal);
        tagCounts.set(tag, existing);
      }
    }
    for (const [tag, tagDeals] of tagCounts) {
      const pct = (tagDeals.length / subset.length) * 100;
      if (pct >= 25 && tagDeals.length >= 2) {
        patterns.push({
          pattern: `Tagged: ${tag}`,
          frequency: tagDeals.length,
          percentage: round2(pct),
          exampleDeals: tagDeals.slice(0, 3).map(d => d.title),
        });
      }
    }

    // Sort by frequency descending, limit to top patterns
    return patterns
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 15);
  }

  // ── Deal Velocity ────────────────────────────────────────────────────

  /**
   * Average time in each stage, with acceleration/deceleration trends.
   */
  async getDealVelocity(): Promise<DealVelocityReport> {
    const deals = await this.loadDeals();
    const closedDeals = deals.filter(d => d.closedAt && d.outcome === 'won');

    const funnelStages: PipelineStage[] = [
      'prospecting',
      'qualification',
      'discovery',
      'proposal',
      'negotiation',
    ];

    const stageResults: DealVelocityStage[] = funnelStages.map(stageName => {
      const durations: { days: number; closedAt: string }[] = [];

      for (const deal of closedDeals) {
        const entry = deal.stageHistory.find(t => t.to === stageName);
        const exit = deal.stageHistory.find(t => t.from === stageName);
        if (entry && exit) {
          durations.push({
            days: daysBetween(entry.at, exit.at),
            closedAt: deal.closedAt!,
          });
        }
      }

      const allDays = durations.map(d => d.days);
      const avgDays = round2(safeDiv(
        allDays.reduce((s, v) => s + v, 0),
        allDays.length,
      ));
      const medianDays = round2(median(allDays));

      // Trend: compare recent 45 days vs. older
      const cutoff = Date.now() - 45 * MS_PER_DAY;
      const recent = durations.filter(d => new Date(d.closedAt).getTime() >= cutoff);
      const older = durations.filter(d => new Date(d.closedAt).getTime() < cutoff);

      const recentAvg = safeDiv(
        recent.reduce((s, d) => s + d.days, 0),
        recent.length,
      );
      const olderAvg = safeDiv(
        older.reduce((s, d) => s + d.days, 0),
        older.length,
      );

      let trend: 'accelerating' | 'stable' | 'decelerating' = 'stable';
      if (older.length > 0 && recent.length > 0) {
        const changePct = safeDiv(recentAvg - olderAvg, olderAvg);
        if (changePct < -0.1) trend = 'accelerating';
        else if (changePct > 0.1) trend = 'decelerating';
      }

      return { stage: stageName, avgDays, medianDays, trend };
    });

    // Overall cycle length
    const overallDays = closedDeals.map(d => daysBetween(d.createdAt, d.closedAt!));
    const overallAvgDays = round2(safeDiv(
      overallDays.reduce((s, v) => s + v, 0),
      overallDays.length,
    ));
    const overallMedianDays = round2(median(overallDays));

    // Overall trend
    const cutoff = Date.now() - 45 * MS_PER_DAY;
    const recentCycles = closedDeals
      .filter(d => new Date(d.closedAt!).getTime() >= cutoff)
      .map(d => daysBetween(d.createdAt, d.closedAt!));
    const olderCycles = closedDeals
      .filter(d => new Date(d.closedAt!).getTime() < cutoff)
      .map(d => daysBetween(d.createdAt, d.closedAt!));

    const recentAvgAll = safeDiv(
      recentCycles.reduce((s, v) => s + v, 0),
      recentCycles.length,
    );
    const olderAvgAll = safeDiv(
      olderCycles.reduce((s, v) => s + v, 0),
      olderCycles.length,
    );

    let overallTrend: 'accelerating' | 'stable' | 'decelerating' = 'stable';
    if (olderCycles.length > 0 && recentCycles.length > 0) {
      const changePct = safeDiv(recentAvgAll - olderAvgAll, olderAvgAll);
      if (changePct < -0.1) overallTrend = 'accelerating';
      else if (changePct > 0.1) overallTrend = 'decelerating';
    }

    return {
      stages: stageResults,
      overallAvgDays,
      overallMedianDays,
      trend: overallTrend,
    };
  }

  // ── Activity Metrics ─────────────────────────────────────────────────

  /**
   * Aggregate activity metrics over the given timeframe.
   */
  async getActivityMetrics(timeframeDays: number = DEFAULT_TIMEFRAME_DAYS): Promise<ActivityMetrics> {
    const activities = await this.loadActivities();
    const deals = await this.loadDeals();

    const relevant = activities.filter(a => isWithinDays(a.at, timeframeDays));

    const emailsSent = relevant.filter(a => a.type === 'email_sent').length;
    const emailsReceived = relevant.filter(a => a.type === 'email_received').length;
    const callsMade = relevant.filter(a => a.type === 'call_made').length;
    const callsReceived = relevant.filter(a => a.type === 'call_received').length;
    const meetings = relevant.filter(a => a.type === 'meeting').length;
    const signalsProcessed = relevant.filter(a => a.type === 'signal_processed').length;
    const notes = relevant.filter(a => a.type === 'note').length;
    const tasksCompleted = relevant.filter(a => a.type === 'task_completed').length;

    const totalActivities = relevant.length;

    const activeDeals = deals.filter(
      d => d.stage !== 'closed_won' && d.stage !== 'closed_lost',
    );
    const activitiesPerDeal = round2(safeDiv(totalActivities, activeDeals.length));
    const activitiesPerDay = round2(safeDiv(totalActivities, timeframeDays));

    return {
      timeframeDays,
      emailsSent,
      emailsReceived,
      callsMade,
      callsReceived,
      meetings,
      signalsProcessed,
      notes,
      tasksCompleted,
      totalActivities,
      activitiesPerDeal,
      activitiesPerDay,
    };
  }

  // ── Trend Data ───────────────────────────────────────────────────────

  /**
   * Time series data for any supported metric.
   */
  async getTrendData(
    metric: 'deals' | 'revenue' | 'signals' | 'win_rate' | 'pipeline_value' | 'activities',
    days: number = DEFAULT_TREND_DAYS,
  ): Promise<TrendDataPoint[]> {
    const deals = await this.loadDeals();
    const activities = await this.loadActivities();
    const points: TrendDataPoint[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const dayDate = new Date(Date.now() - i * MS_PER_DAY);
      const dateStr = toISODate(dayDate);
      const nextDateStr = toISODate(new Date(dayDate.getTime() + MS_PER_DAY));

      let value = 0;
      let label: string | undefined;

      switch (metric) {
        case 'deals': {
          value = deals.filter(
            d => d.createdAt >= dateStr && d.createdAt < nextDateStr,
          ).length;
          label = `${value} new deals`;
          break;
        }
        case 'revenue': {
          value = deals
            .filter(
              d =>
                d.outcome === 'won' &&
                d.closedAt &&
                d.closedAt >= dateStr &&
                d.closedAt < nextDateStr,
            )
            .reduce((s, d) => s + d.value, 0);
          label = `$${value.toLocaleString()} closed`;
          break;
        }
        case 'signals': {
          // Count deal activities that are signals
          value = activities.filter(
            a => a.type === 'signal_processed' && a.at >= dateStr && a.at < nextDateStr,
          ).length;
          label = `${value} signals`;
          break;
        }
        case 'win_rate': {
          // Rolling 30-day win rate up to this date
          const windowStart = toISODate(new Date(dayDate.getTime() - 30 * MS_PER_DAY));
          const closed = deals.filter(
            d =>
              d.closedAt &&
              d.closedAt >= windowStart &&
              d.closedAt <= dateStr &&
              (d.outcome === 'won' || d.outcome === 'lost'),
          );
          const won = closed.filter(d => d.outcome === 'won').length;
          value = round2(safeDiv(won, closed.length));
          label = `${Math.round(value * 100)}% win rate`;
          break;
        }
        case 'pipeline_value': {
          // Total pipeline value at end of each day (deals created before and not yet closed)
          value = deals
            .filter(d => {
              const created = d.createdAt <= nextDateStr;
              const notYetClosed = !d.closedAt || d.closedAt > dateStr;
              const notTerminal = d.stage !== 'closed_won' && d.stage !== 'closed_lost';
              // For historical approximation: if closed after this date, consider it open
              return created && (notTerminal || (d.closedAt && d.closedAt > dateStr) || notYetClosed);
            })
            .reduce((s, d) => s + d.value, 0);
          label = `$${value.toLocaleString()} pipeline`;
          break;
        }
        case 'activities': {
          value = activities.filter(
            a => a.at >= dateStr && a.at < nextDateStr,
          ).length;
          label = `${value} activities`;
          break;
        }
      }

      points.push({ date: dateStr, value, label });
    }

    return points;
  }

  // ── Executive Summary ────────────────────────────────────────────────

  /**
   * High-level KPIs for executive dashboards.
   */
  async getExecutiveSummary(): Promise<ExecutiveSummary> {
    const deals = await this.loadDeals();
    const qStart = quarterStart();

    const openDeals = deals.filter(
      d => d.stage !== 'closed_won' && d.stage !== 'closed_lost',
    );

    const pipelineValue = round2(openDeals.reduce((s, d) => s + d.value, 0));
    const weightedPipeline = round2(
      openDeals.reduce((sum, d) => sum + d.value * (STAGE_WEIGHTS[d.stage] ?? 0), 0),
    );

    const wonThisQ = deals.filter(
      d => d.outcome === 'won' && d.closedAt && new Date(d.closedAt) >= qStart,
    );
    const dealsWonThisPeriod = wonThisQ.length;
    const revenueThisPeriod = round2(wonThisQ.reduce((s, d) => s + d.value, 0));

    const closedAll = deals.filter(d => d.outcome === 'won' || d.outcome === 'lost');
    const winRate = round2(
      safeDiv(closedAll.filter(d => d.outcome === 'won').length, closedAll.length),
    );

    const wonAll = deals.filter(d => d.outcome === 'won');
    const avgDealSize = round2(
      safeDiv(wonAll.reduce((s, d) => s + d.value, 0), wonAll.length),
    );

    const cycleLengths = wonAll
      .filter(d => d.closedAt)
      .map(d => daysBetween(d.createdAt, d.closedAt!));
    const avgCycleLength = round2(
      safeDiv(cycleLengths.reduce((s, v) => s + v, 0), cycleLengths.length),
    );

    // Top signal types by frequency across won deals
    const signalCounts = new Map<string, number>();
    for (const deal of wonAll) {
      for (const sig of deal.signalTypes) {
        signalCounts.set(sig, (signalCounts.get(sig) ?? 0) + 1);
      }
    }
    const topSignals = [...signalCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type]) => type);

    let forecast: ForecastModel | null = null;
    try {
      forecast = await this.generateForecast();
    } catch {
      // Forecast may fail if data is insufficient; that's okay
    }

    const velocity = await this.getDealVelocity();
    const insights = await this.generateInsights();

    return {
      pipelineValue,
      weightedPipeline,
      forecast,
      winRate,
      avgDealSize,
      avgCycleLength,
      totalDeals: deals.length,
      dealsWonThisPeriod,
      revenueThisPeriod,
      topSignals,
      velocity,
      insights,
    };
  }

  // ── Automated Insights ───────────────────────────────────────────────

  /**
   * Generate auto-detected insight narratives from current data.
   * Returns human-readable strings that surface the most impactful patterns.
   */
  async generateInsights(): Promise<string[]> {
    const deals = await this.loadDeals();
    const insights: string[] = [];

    if (deals.length === 0) {
      insights.push('No deal data available yet. Start tracking deals to unlock pipeline insights.');
      return insights;
    }

    const wonDeals = deals.filter(d => d.outcome === 'won');
    const lostDeals = deals.filter(d => d.outcome === 'lost');
    const openDeals = deals.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost');
    const closedTotal = wonDeals.length + lostDeals.length;

    // ── Win rate trend ─────────────────────────────────────────
    if (closedTotal > 0) {
      const thirtyDaysAgo = Date.now() - 30 * MS_PER_DAY;
      const sixtyDaysAgo = Date.now() - 60 * MS_PER_DAY;

      const recentClosed = deals.filter(
        d => d.closedAt && new Date(d.closedAt).getTime() >= thirtyDaysAgo && (d.outcome === 'won' || d.outcome === 'lost'),
      );
      const olderClosed = deals.filter(
        d =>
          d.closedAt &&
          new Date(d.closedAt).getTime() >= sixtyDaysAgo &&
          new Date(d.closedAt).getTime() < thirtyDaysAgo &&
          (d.outcome === 'won' || d.outcome === 'lost'),
      );

      if (recentClosed.length >= 3 && olderClosed.length >= 3) {
        const recentWinRate = safeDiv(
          recentClosed.filter(d => d.outcome === 'won').length,
          recentClosed.length,
        );
        const olderWinRate = safeDiv(
          olderClosed.filter(d => d.outcome === 'won').length,
          olderClosed.length,
        );
        const diff = recentWinRate - olderWinRate;

        if (diff > 0.05) {
          insights.push(
            `Win rate improved ${Math.round(diff * 100)}% this month, driven by better signal timing`,
          );
        } else if (diff < -0.05) {
          insights.push(
            `Win rate declined ${Math.round(Math.abs(diff) * 100)}% this month — review recent losses for patterns`,
          );
        }
      }
    }

    // ── Multi-signal deals close faster ────────────────────────
    const multiSignalWon = wonDeals.filter(d => d.signalTypes.length >= 3 && d.closedAt);
    const singleSignalWon = wonDeals.filter(d => d.signalTypes.length < 3 && d.closedAt);

    if (multiSignalWon.length >= 2 && singleSignalWon.length >= 2) {
      const multiAvg = safeDiv(
        multiSignalWon.reduce((s, d) => s + daysBetween(d.createdAt, d.closedAt!), 0),
        multiSignalWon.length,
      );
      const singleAvg = safeDiv(
        singleSignalWon.reduce((s, d) => s + daysBetween(d.createdAt, d.closedAt!), 0),
        singleSignalWon.length,
      );

      if (singleAvg > 0 && multiAvg > 0 && multiAvg < singleAvg) {
        const speedup = round2(singleAvg / multiAvg);
        insights.push(
          `Deals with 3+ signal types close ${speedup}x faster`,
        );
      }
    }

    // ── Bottleneck stage ───────────────────────────────────────
    try {
      const funnel = await this.getConversionFunnel();
      const bottleneck = funnel.stages.find(s => s.name === funnel.bottleneck);
      if (bottleneck && bottleneck.entered > 0) {
        const dropPct = Math.round((1 - bottleneck.conversionRate) * 100);
        insights.push(
          `${capitalize(bottleneck.name)} stage is your biggest bottleneck — ${dropPct}% of deals stall here`,
        );
      }
    } catch {
      // Funnel analysis may fail with insufficient data
    }

    // ── Top-performing signal type ─────────────────────────────
    const signalROIs = await this.getSignalROI();
    const topSignal = signalROIs
      .filter(s => s.dealsInfluenced >= 2)
      .sort((a, b) => b.conversionRate - a.conversionRate)[0];

    if (topSignal) {
      insights.push(
        `${formatSignalName(topSignal.signalType)} signals lead to highest close rates (${Math.round(topSignal.conversionRate * 100)}%)`,
      );
    }

    // ── Pipeline health ────────────────────────────────────────
    if (openDeals.length > 0) {
      const pipelineValue = openDeals.reduce((s, d) => s + d.value, 0);
      const avgDealValue = safeDiv(pipelineValue, openDeals.length);

      // Check if pipeline is top-heavy
      const negotiationValue = openDeals
        .filter(d => d.stage === 'negotiation')
        .reduce((s, d) => s + d.value, 0);
      const prospectingValue = openDeals
        .filter(d => d.stage === 'prospecting')
        .reduce((s, d) => s + d.value, 0);

      if (pipelineValue > 0 && negotiationValue / pipelineValue > 0.5) {
        insights.push(
          'Pipeline is top-heavy — 50%+ of value is in negotiation. Focus on sourcing new opportunities',
        );
      } else if (pipelineValue > 0 && prospectingValue / pipelineValue > 0.6) {
        insights.push(
          'Pipeline is early-stage heavy — invest in moving prospects through qualification',
        );
      }

      // Stale deals warning
      const staleDeals = openDeals.filter(d => {
        const daysSinceUpdate = (Date.now() - new Date(d.updatedAt).getTime()) / MS_PER_DAY;
        return daysSinceUpdate > 14;
      });
      if (staleDeals.length > 0) {
        const staleValue = staleDeals.reduce((s, d) => s + d.value, 0);
        insights.push(
          `${staleDeals.length} deals ($${Math.round(staleValue).toLocaleString()}) have had no activity in 14+ days`,
        );
      }

      // Average deal size trend
      if (wonDeals.length >= 5) {
        insights.push(
          `Average deal size is $${Math.round(avgDealValue).toLocaleString()} across ${openDeals.length} open deals`,
        );
      }
    }

    // ── Velocity insight ───────────────────────────────────────
    try {
      const velocity = await this.getDealVelocity();
      if (velocity.trend === 'accelerating') {
        insights.push(
          'Deal velocity is accelerating — average cycle length is decreasing',
        );
      } else if (velocity.trend === 'decelerating') {
        insights.push(
          `Deal velocity is slowing — average cycle is ${velocity.overallAvgDays} days. Identify and remove friction points`,
        );
      }
    } catch {
      // Velocity analysis may fail with insufficient data
    }

    // ── Rep performance variance ───────────────────────────────
    try {
      const leaderboard = await this.getRepLeaderboard();
      if (leaderboard.length >= 2) {
        const topRep = leaderboard[0]!;
        const winRates = leaderboard.filter(r => (r.dealsWon + r.dealsLost) >= 3).map(r => r.winRate);
        if (winRates.length >= 2) {
          const maxWinRate = Math.max(...winRates);
          const minWinRate = Math.min(...winRates);
          const spread = maxWinRate - minWinRate;
          if (spread > 0.2) {
            insights.push(
              `Win rate varies ${Math.round(spread * 100)}% across reps — ${topRep.memberName} leads at ${Math.round(topRep.winRate * 100)}%`,
            );
          }
        }
      }
    } catch {
      // Leaderboard may fail
    }

    // ── Forecast gap ───────────────────────────────────────────
    try {
      const forecast = await this.generateForecast();
      if (forecast.gap > 0 && forecast.confidence >= 0.3) {
        insights.push(
          `Forecast gap of $${Math.round(forecast.gap).toLocaleString()} for ${forecast.period} — pipeline coverage may be insufficient`,
        );
      } else if (forecast.gap < 0) {
        insights.push(
          `On track to exceed target by $${Math.round(Math.abs(forecast.gap)).toLocaleString()} for ${forecast.period}`,
        );
      }
    } catch {
      // Forecast may fail
    }

    return insights;
  }
}

// ── Formatting helpers (module-private) ────────────────────────────────────

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
}

function formatSignalName(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ── Singleton Export ───────────────────────────────────────────────────────

export const revenueAnalytics = new RevenueAnalyticsEngine();
