/**
 * Buyer Intent Scoring Service
 * Ingests multi-channel intent signals, computes weighted scores with time-decay,
 * detects surges via z-score analysis, and produces composite lead grades.
 */

import { getPersistentCache, setPersistentCache } from './persistent-cache';

// ── Constants ────────────────────────────────────────────────────────────────

const CACHE_KEY_SIGNALS = 'buyer-intent:signals';
const CACHE_KEY_SCORES = 'buyer-intent:scores';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = 7 * MS_PER_DAY;
const PRUNE_THRESHOLD_MS = 90 * MS_PER_DAY;
const DECAY_RATE_PER_WEEK = 0.10; // 10 % loss per week

const SURGE_WINDOW_MS = 7 * MS_PER_DAY;
const SURGE_Z_THRESHOLD = 2.0;

// ── Channel Weights ──────────────────────────────────────────────────────────

const CHANNEL_WEIGHTS: Record<IntentChannel, number> = {
  website: 1.2,
  content: 1.0,
  search: 1.5,
  review_site: 1.8,
  job_board: 0.8,
  social: 0.7,
  news: 0.9,
  event: 1.1,
};

// ── Action Weights ───────────────────────────────────────────────────────────

interface ActionWeightEntry {
  pattern: RegExp;
  weight: number;
}

const ACTION_WEIGHTS: ActionWeightEntry[] = [
  { pattern: /demo[\s_-]?request/i, weight: 5.0 },
  { pattern: /pricing[\s_-]?page/i, weight: 3.0 },
  { pattern: /competitor[\s_-]?comparison/i, weight: 2.0 },
  { pattern: /case[\s_-]?study/i, weight: 1.5 },
  { pattern: /whitepaper/i, weight: 1.0 },
  { pattern: /blog/i, weight: 0.5 },
];

function getActionWeight(action: string): number {
  for (const entry of ACTION_WEIGHTS) {
    if (entry.pattern.test(action)) return entry.weight;
  }
  return 1.0; // default for unrecognised actions
}

// ── Types ────────────────────────────────────────────────────────────────────

export type IntentChannel =
  | 'website'
  | 'content'
  | 'social'
  | 'search'
  | 'review_site'
  | 'job_board'
  | 'news'
  | 'event';

export type IntentCategory =
  | 'research'
  | 'comparison'
  | 'evaluation'
  | 'purchase';

export type BuyerIntentLevel =
  | 'hot'
  | 'warm'
  | 'interested'
  | 'aware'
  | 'cold';

export type IntentTrend =
  | 'surging'
  | 'rising'
  | 'stable'
  | 'declining'
  | 'new';

export type PurchaseTimeframe =
  | '0-30 days'
  | '1-3 months'
  | '3-6 months'
  | '6+ months'
  | 'unknown';

export type LeadGrade =
  | 'A+'
  | 'A'
  | 'B+'
  | 'B'
  | 'C'
  | 'D'
  | 'F';

export type LeadRecommendation =
  | 'immediate_outreach'
  | 'nurture'
  | 'monitor'
  | 'disqualify';

export interface IntentSignal {
  id: string;
  company: string;
  companyDomain?: string;
  channel: IntentChannel;
  action: string;
  timestamp: number; // epoch ms
  strength: number;  // 1-10
  category: IntentCategory;
  metadata: Record<string, string>;
}

export interface BuyerIntentScore {
  company: string;
  companyDomain?: string;
  overallScore: number;        // 0-100
  level: BuyerIntentLevel;
  trend: IntentTrend;
  channelBreakdown: Partial<Record<IntentChannel, number>>;
  topActions: IntentSignal[];
  predictedTimeframe: PurchaseTimeframe;
  confidenceLevel: number;     // 0-1
  lastActivity: number;        // epoch ms
  scoredAt: number;            // epoch ms
}

export interface ScoringFactor {
  name: string;
  score: number;
  weight: number;
  reasoning: string;
}

export interface LeadScore {
  company: string;
  companyDomain?: string;
  fitScore: number;            // ICP match 0-100
  intentScore: number;         // 0-100
  engagementScore: number;     // 0-100
  compositeScore: number;      // 0-100
  grade: LeadGrade;
  recommendation: LeadRecommendation;
  factors: ScoringFactor[];
}

export interface BuyerCompanyInfo {
  industry?: string;
  employeeCount?: number;
  revenue?: string;
  techStack?: string[];
  location?: string;
  fundingStage?: string;
}

export interface ChannelAnalytics {
  channel: IntentChannel;
  signalCount: number;
  averageStrength: number;
  weightedScore: number;
  topCompanies: string[];
}

// ── Serialisation helpers (Date-safe round-tripping) ─────────────────────────

interface PersistedState {
  signals: IntentSignal[];
  savedAt: number;
}

// ── Utility helpers ──────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function computeTimeDecay(signalTimestamp: number, now: number): number {
  const ageMs = Math.max(0, now - signalTimestamp);
  const weeksOld = ageMs / MS_PER_WEEK;
  return Math.max(0, 1 - DECAY_RATE_PER_WEEK * weeksOld);
}

function deriveLevel(score: number): BuyerIntentLevel {
  if (score >= 80) return 'hot';
  if (score >= 60) return 'warm';
  if (score >= 40) return 'interested';
  if (score >= 20) return 'aware';
  return 'cold';
}

function deriveGrade(compositeScore: number): LeadGrade {
  if (compositeScore >= 90) return 'A+';
  if (compositeScore >= 80) return 'A';
  if (compositeScore >= 70) return 'B+';
  if (compositeScore >= 60) return 'B';
  if (compositeScore >= 40) return 'C';
  if (compositeScore >= 20) return 'D';
  return 'F';
}

function deriveRecommendation(grade: LeadGrade, trend: IntentTrend): LeadRecommendation {
  if (grade === 'A+' || grade === 'A') return 'immediate_outreach';
  if (grade === 'B+' || grade === 'B') {
    return trend === 'surging' || trend === 'rising' ? 'immediate_outreach' : 'nurture';
  }
  if (grade === 'C') return 'monitor';
  return 'disqualify';
}

// ── BuyerIntentEngine ────────────────────────────────────────────────────────

export class BuyerIntentEngine {
  private signals: IntentSignal[] = [];
  private companyIndex: Map<string, IntentSignal[]> = new Map();
  private loaded = false;
  private loadPromise: Promise<void> | null = null;
  private dirty = false;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Lifecycle ────────────────────────────────────────────────────────────

  private ensureLoaded(): Promise<void> {
    if (this.loaded) return Promise.resolve();
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = this.load();
    return this.loadPromise;
  }

  private async load(): Promise<void> {
    try {
      const envelope = await getPersistentCache<PersistedState>(CACHE_KEY_SIGNALS);
      if (envelope?.data?.signals) {
        this.signals = envelope.data.signals;
        this.rebuildIndex();
        this.pruneStaleSignals();
      }
    } catch (err) {
      console.warn('[buyer-intent] Failed to load persisted signals', err);
    } finally {
      this.loaded = true;
    }
  }

  private rebuildIndex(): void {
    this.companyIndex.clear();
    for (const signal of this.signals) {
      const key = this.normalizeCompany(signal.company);
      let bucket = this.companyIndex.get(key);
      if (!bucket) {
        bucket = [];
        this.companyIndex.set(key, bucket);
      }
      bucket.push(signal);
    }
  }

  private pruneStaleSignals(): void {
    const now = Date.now();
    const before = this.signals.length;
    this.signals = this.signals.filter(s => (now - s.timestamp) < PRUNE_THRESHOLD_MS);
    if (this.signals.length !== before) {
      this.rebuildIndex();
      this.markDirty();
    }
  }

  private markDirty(): void {
    this.dirty = true;
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      if (this.dirty) {
        this.dirty = false;
        this.persist().catch(err =>
          console.warn('[buyer-intent] Background persist failed', err),
        );
      }
    }, 2_000);
  }

  private async persist(): Promise<void> {
    const state: PersistedState = {
      signals: this.signals,
      savedAt: Date.now(),
    };
    await setPersistentCache(CACHE_KEY_SIGNALS, state);
  }

  private normalizeCompany(name: string): string {
    return name.trim().toLowerCase();
  }

  private getCompanySignals(company: string): IntentSignal[] {
    return this.companyIndex.get(this.normalizeCompany(company)) ?? [];
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Ingest a single intent signal.
   */
  async recordIntent(signal: IntentSignal): Promise<void> {
    await this.ensureLoaded();

    // Validate strength range
    signal.strength = clamp(signal.strength, 1, 10);

    this.signals.push(signal);
    const key = this.normalizeCompany(signal.company);
    let bucket = this.companyIndex.get(key);
    if (!bucket) {
      bucket = [];
      this.companyIndex.set(key, bucket);
    }
    bucket.push(signal);
    this.markDirty();
  }

  /**
   * Bulk-ingest multiple intent signals.
   */
  async recordBulkIntent(signals: IntentSignal[]): Promise<void> {
    await this.ensureLoaded();

    for (const signal of signals) {
      signal.strength = clamp(signal.strength, 1, 10);
      this.signals.push(signal);
      const key = this.normalizeCompany(signal.company);
      let bucket = this.companyIndex.get(key);
      if (!bucket) {
        bucket = [];
        this.companyIndex.set(key, bucket);
      }
      bucket.push(signal);
    }
    this.markDirty();
  }

  /**
   * Calculate the buyer intent score for a given company.
   */
  async getIntentScore(company: string): Promise<BuyerIntentScore> {
    await this.ensureLoaded();

    const now = Date.now();
    const signals = this.getCompanySignals(company);

    if (signals.length === 0) {
      return this.emptyIntentScore(company, now);
    }

    // Compute per-signal weighted contributions
    const channelTotals: Partial<Record<IntentChannel, number>> = {};
    let totalWeightedScore = 0;
    let maxTimestamp = 0;

    for (const sig of signals) {
      const decay = computeTimeDecay(sig.timestamp, now);
      if (decay <= 0) continue;

      const channelW = CHANNEL_WEIGHTS[sig.channel];
      const actionW = getActionWeight(sig.action);
      const contribution = sig.strength * channelW * actionW * decay;

      totalWeightedScore += contribution;
      channelTotals[sig.channel] = (channelTotals[sig.channel] ?? 0) + contribution;

      if (sig.timestamp > maxTimestamp) {
        maxTimestamp = sig.timestamp;
      }
    }

    // Normalise overall score to 0-100 using a log-based curve so it
    // doesn't trivially saturate with many signals.
    const rawNorm = Math.log1p(totalWeightedScore) / Math.log1p(500);
    const overallScore = clamp(Math.round(rawNorm * 100), 0, 100);

    // Top actions: highest contribution first, up to 10
    const scored = signals
      .map(sig => {
        const decay = computeTimeDecay(sig.timestamp, now);
        return {
          signal: sig,
          score: sig.strength * CHANNEL_WEIGHTS[sig.channel] * getActionWeight(sig.action) * decay,
        };
      })
      .sort((a, b) => b.score - a.score);

    const topActions = scored.slice(0, 10).map(s => s.signal);

    // Trend
    const trend = this.computeTrend(signals, now);

    // Predicted timeframe
    const predictedTimeframe = this.computeTimeframe(overallScore, trend, signals, now);

    // Confidence: based on signal count and recency diversity
    const confidenceLevel = this.computeConfidence(signals, now);

    // Normalise channel breakdown to 0-100
    const channelBreakdown: Partial<Record<IntentChannel, number>> = {};
    const maxChannel = Math.max(...Object.values(channelTotals).map(v => v ?? 0), 1);
    for (const [ch, val] of Object.entries(channelTotals) as [IntentChannel, number][]) {
      channelBreakdown[ch] = clamp(Math.round((val / maxChannel) * 100), 0, 100);
    }

    const domain = signals.find(s => s.companyDomain)?.companyDomain;

    return {
      company,
      companyDomain: domain,
      overallScore,
      level: deriveLevel(overallScore),
      trend,
      channelBreakdown,
      topActions,
      predictedTimeframe,
      confidenceLevel,
      lastActivity: maxTimestamp,
      scoredAt: now,
    };
  }

  /**
   * Full lead score combining ICP fit, intent, and engagement.
   */
  async getLeadScore(company: string, companyInfo?: BuyerCompanyInfo): Promise<LeadScore> {
    await this.ensureLoaded();

    const intentResult = await this.getIntentScore(company);
    const signals = this.getCompanySignals(company);
    const now = Date.now();

    const factors: ScoringFactor[] = [];

    // ── Intent Score ─────────────────────────────────────────────────────
    const intentScore = intentResult.overallScore;
    factors.push({
      name: 'Intent Score',
      score: intentScore,
      weight: 0.45,
      reasoning: `Based on ${signals.length} signal(s) across ${Object.keys(intentResult.channelBreakdown).length} channel(s). Trend: ${intentResult.trend}.`,
    });

    // ── Fit Score (ICP match) ────────────────────────────────────────────
    const fitScore = this.computeFitScore(companyInfo, factors);

    // ── Engagement Score ─────────────────────────────────────────────────
    const engagementScore = this.computeEngagementScore(signals, now, factors);

    // ── Composite ────────────────────────────────────────────────────────
    const compositeScore = clamp(
      Math.round(intentScore * 0.45 + fitScore * 0.30 + engagementScore * 0.25),
      0,
      100,
    );

    const grade = deriveGrade(compositeScore);
    const recommendation = deriveRecommendation(grade, intentResult.trend);

    const domain = signals.find(s => s.companyDomain)?.companyDomain;

    return {
      company,
      companyDomain: domain,
      fitScore,
      intentScore,
      engagementScore,
      compositeScore,
      grade,
      recommendation,
      factors,
    };
  }

  /**
   * Return all tracked companies ranked by intent score (descending).
   */
  async getTopIntentCompanies(limit = 25): Promise<BuyerIntentScore[]> {
    await this.ensureLoaded();

    const companies = [...this.companyIndex.keys()];
    const scores: BuyerIntentScore[] = [];

    for (const companyKey of companies) {
      const bucket = this.companyIndex.get(companyKey);
      if (!bucket || bucket.length === 0) continue;
      // Use the original-case company name from the first signal
      const first = bucket[0];
      if (!first) continue;
      const companyName = first.company;
      const score = await this.getIntentScore(companyName);
      scores.push(score);
    }

    scores.sort((a, b) => b.overallScore - a.overallScore);
    return scores.slice(0, limit);
  }

  /**
   * Full signal history for a given company, sorted chronologically.
   */
  async getIntentTimeline(company: string): Promise<IntentSignal[]> {
    await this.ensureLoaded();
    const signals = this.getCompanySignals(company);
    return [...signals].sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Detect companies with rapidly increasing intent (z-score > 2.0 on
   * a 7-day rolling window compared to historical weekly averages).
   */
  async getIntentSurges(): Promise<BuyerIntentScore[]> {
    await this.ensureLoaded();

    const surges: BuyerIntentScore[] = [];

    for (const [, bucket] of this.companyIndex) {
      if (bucket.length === 0) continue;
      const first = bucket[0];
      if (!first) continue;
      const companyName = first.company;
      const zScore = this.computeZScore(bucket);
      if (zScore > SURGE_Z_THRESHOLD) {
        const score = await this.getIntentScore(companyName);
        surges.push(score);
      }
    }

    surges.sort((a, b) => b.overallScore - a.overallScore);
    return surges;
  }

  /**
   * Aggregate analytics across all channels.
   */
  async getChannelAnalytics(): Promise<ChannelAnalytics[]> {
    await this.ensureLoaded();

    const now = Date.now();
    const channelMap = new Map<IntentChannel, { signals: IntentSignal[]; weightedTotal: number }>();

    for (const sig of this.signals) {
      const decay = computeTimeDecay(sig.timestamp, now);
      if (decay <= 0) continue;

      let entry = channelMap.get(sig.channel);
      if (!entry) {
        entry = { signals: [], weightedTotal: 0 };
        channelMap.set(sig.channel, entry);
      }
      entry.signals.push(sig);
      entry.weightedTotal += sig.strength * CHANNEL_WEIGHTS[sig.channel] * getActionWeight(sig.action) * decay;
    }

    const results: ChannelAnalytics[] = [];

    for (const [channel, entry] of channelMap) {
      const strengths = entry.signals.map(s => s.strength);
      const avgStrength = mean(strengths);

      // Top companies by count for this channel
      const companyCount = new Map<string, number>();
      for (const sig of entry.signals) {
        const key = this.normalizeCompany(sig.company);
        companyCount.set(key, (companyCount.get(key) ?? 0) + 1);
      }
      const topCompanies = [...companyCount.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([company]) => {
          // Recover original-case name
          const bucket = this.companyIndex.get(company);
          return bucket?.[0]?.company ?? company;
        });

      results.push({
        channel,
        signalCount: entry.signals.length,
        averageStrength: Math.round(avgStrength * 10) / 10,
        weightedScore: Math.round(entry.weightedTotal * 10) / 10,
        topCompanies,
      });
    }

    results.sort((a, b) => b.weightedScore - a.weightedScore);
    return results;
  }

  /**
   * ML-like heuristic for predicting purchase timing.
   */
  async predictPurchaseTimeframe(company: string): Promise<{
    timeframe: PurchaseTimeframe;
    confidence: number;
    reasoning: string;
  }> {
    await this.ensureLoaded();

    const signals = this.getCompanySignals(company);
    const now = Date.now();

    if (signals.length === 0) {
      return {
        timeframe: 'unknown',
        confidence: 0,
        reasoning: 'No intent signals recorded for this company.',
      };
    }

    const recentWindow = 14 * MS_PER_DAY;
    const recentSignals = signals.filter(s => (now - s.timestamp) < recentWindow);

    // Features used for heuristic
    const totalSignals = signals.length;
    const recentCount = recentSignals.length;
    const hasDemoRequest = signals.some(s => /demo[\s_-]?request/i.test(s.action));
    const hasPricingVisit = signals.some(s => /pricing[\s_-]?page/i.test(s.action));
    const hasCompetitorComparison = signals.some(s => /competitor[\s_-]?comparison/i.test(s.action));
    const hasEvaluationSignals = signals.some(s => s.category === 'evaluation');
    const hasPurchaseSignals = signals.some(s => s.category === 'purchase');
    const channelDiversity = new Set(signals.map(s => s.channel)).size;
    const avgStrength = mean(signals.map(s => s.strength));
    const trend = this.computeTrend(signals, now);

    // Score accumulation for timeframe heuristic
    let urgency = 0;
    const reasons: string[] = [];

    if (hasDemoRequest) { urgency += 30; reasons.push('Demo request detected'); }
    if (hasPricingVisit) { urgency += 20; reasons.push('Pricing page visited'); }
    if (hasCompetitorComparison) { urgency += 15; reasons.push('Competitor comparison activity'); }
    if (hasPurchaseSignals) { urgency += 25; reasons.push('Purchase-category signals present'); }
    if (hasEvaluationSignals) { urgency += 10; reasons.push('Evaluation-stage signals present'); }
    if (recentCount >= 5) { urgency += 15; reasons.push(`${recentCount} signals in last 14 days`); }
    if (channelDiversity >= 3) { urgency += 10; reasons.push(`Activity across ${channelDiversity} channels`); }
    if (avgStrength >= 7) { urgency += 10; reasons.push(`High average signal strength (${avgStrength.toFixed(1)})`); }
    if (trend === 'surging') { urgency += 20; reasons.push('Surge detected'); }
    else if (trend === 'rising') { urgency += 10; reasons.push('Rising trend'); }

    urgency = clamp(urgency, 0, 100);

    let timeframe: PurchaseTimeframe;
    if (urgency >= 75) timeframe = '0-30 days';
    else if (urgency >= 50) timeframe = '1-3 months';
    else if (urgency >= 25) timeframe = '3-6 months';
    else if (totalSignals >= 2) timeframe = '6+ months';
    else timeframe = 'unknown';

    // Confidence scales with data volume and diversity
    const confidence = clamp(
      (Math.min(totalSignals, 20) / 20) * 0.5 +
      (Math.min(channelDiversity, 5) / 5) * 0.3 +
      (recentCount > 0 ? 0.2 : 0),
      0,
      1,
    );

    return {
      timeframe,
      confidence: Math.round(confidence * 100) / 100,
      reasoning: reasons.length > 0 ? reasons.join('. ') + '.' : 'Insufficient signals for strong prediction.',
    };
  }

  /**
   * Batch-score all tracked companies.
   */
  async scoreAllCompanies(): Promise<LeadScore[]> {
    await this.ensureLoaded();

    const results: LeadScore[] = [];

    for (const [, bucket] of this.companyIndex) {
      if (bucket.length === 0) continue;
      const first = bucket[0];
      if (!first) continue;
      const companyName = first.company;
      const leadScore = await this.getLeadScore(companyName);
      results.push(leadScore);
    }

    results.sort((a, b) => b.compositeScore - a.compositeScore);

    // Persist scored results
    await setPersistentCache(CACHE_KEY_SCORES, {
      scores: results,
      scoredAt: Date.now(),
    }).catch(err => console.warn('[buyer-intent] Failed to persist scores', err));

    return results;
  }

  // ── Internal scoring helpers ─────────────────────────────────────────────

  private computeTrend(signals: IntentSignal[], now: number): IntentTrend {
    if (signals.length === 0) return 'new';
    if (signals.length === 1) {
      const single = signals[0];
      if (!single) return 'new';
      const ageMs = now - single.timestamp;
      return ageMs < SURGE_WINDOW_MS ? 'new' : 'stable';
    }

    // Check for surge first
    const zScore = this.computeZScore(signals);
    if (zScore > SURGE_Z_THRESHOLD) return 'surging';

    // Compare last-7-day volume to prior-7-day volume
    const thisWeek = signals.filter(s => (now - s.timestamp) < SURGE_WINDOW_MS);
    const lastWeek = signals.filter(s => {
      const age = now - s.timestamp;
      return age >= SURGE_WINDOW_MS && age < 2 * SURGE_WINDOW_MS;
    });

    const thisCount = thisWeek.length;
    const lastCount = lastWeek.length;

    if (lastCount === 0 && thisCount > 0) return 'new';
    if (thisCount === 0 && lastCount > 0) return 'declining';
    if (lastCount === 0 && thisCount === 0) return 'stable';

    const ratio = thisCount / lastCount;
    if (ratio >= 1.5) return 'rising';
    if (ratio <= 0.5) return 'declining';
    return 'stable';
  }

  /**
   * Z-score for surge detection.
   * Compares the most recent 7-day signal count against the distribution
   * of weekly signal counts over the full history.
   */
  private computeZScore(signals: IntentSignal[]): number {
    if (signals.length < 3) return 0;

    const now = Date.now();
    const earliest = Math.min(...signals.map(s => s.timestamp));
    const spanMs = now - earliest;
    const totalWeeks = Math.max(1, Math.ceil(spanMs / MS_PER_WEEK));

    // Build weekly buckets
    const weeklySignalCounts: number[] = new Array(totalWeeks).fill(0);
    for (const sig of signals) {
      const weekIndex = Math.min(
        totalWeeks - 1,
        Math.floor((now - sig.timestamp) / MS_PER_WEEK),
      );
      const current = weeklySignalCounts[weekIndex];
      if (current !== undefined) {
        weeklySignalCounts[weekIndex] = current + 1;
      }
    }

    // Current week is index 0
    const currentWeekCount = weeklySignalCounts[0] ?? 0;
    const historicalWeeks = weeklySignalCounts.slice(1);

    if (historicalWeeks.length === 0) return 0;

    const m = mean(historicalWeeks);
    const sd = stddev(historicalWeeks);

    if (sd === 0) {
      // All historical weeks had the same count
      return currentWeekCount > m ? 3.0 : 0;
    }

    return (currentWeekCount - m) / sd;
  }

  private computeTimeframe(
    overallScore: number,
    trend: IntentTrend,
    signals: IntentSignal[],
    now: number,
  ): PurchaseTimeframe {
    if (signals.length === 0) return 'unknown';

    const hasPurchaseSignals = signals.some(s => s.category === 'purchase');
    const hasEvaluation = signals.some(s => s.category === 'evaluation');
    const recentHighStrength = signals.some(
      s => s.strength >= 8 && (now - s.timestamp) < 14 * MS_PER_DAY,
    );

    if (overallScore >= 80 && (hasPurchaseSignals || recentHighStrength)) return '0-30 days';
    if (overallScore >= 60 && (hasEvaluation || trend === 'surging' || trend === 'rising')) return '1-3 months';
    if (overallScore >= 30) return '3-6 months';
    if (signals.length >= 2) return '6+ months';
    return 'unknown';
  }

  private computeConfidence(signals: IntentSignal[], now: number): number {
    if (signals.length === 0) return 0;

    const channelDiversity = new Set(signals.map(s => s.channel)).size;
    const categoryDiversity = new Set(signals.map(s => s.category)).size;
    const recentCount = signals.filter(s => (now - s.timestamp) < 30 * MS_PER_DAY).length;
    const totalCount = signals.length;

    // Volume component (up to 0.3)
    const volumeComponent = Math.min(totalCount, 30) / 30 * 0.3;

    // Recency component (up to 0.25)
    const recencyComponent = Math.min(recentCount, 15) / 15 * 0.25;

    // Channel diversity component (up to 0.25)
    const channelComponent = Math.min(channelDiversity, 5) / 5 * 0.25;

    // Category diversity component (up to 0.2)
    const categoryComponent = Math.min(categoryDiversity, 4) / 4 * 0.2;

    return Math.round((volumeComponent + recencyComponent + channelComponent + categoryComponent) * 100) / 100;
  }

  private computeFitScore(companyInfo: BuyerCompanyInfo | undefined, factors: ScoringFactor[]): number {
    if (!companyInfo) {
      factors.push({
        name: 'ICP Fit',
        score: 50,
        weight: 0.30,
        reasoning: 'No company information provided; defaulting to neutral fit score.',
      });
      return 50;
    }

    let fitScore = 50; // baseline
    const fitReasons: string[] = [];

    // Employee count scoring (mid-market and enterprise are ideal)
    if (companyInfo.employeeCount !== undefined) {
      if (companyInfo.employeeCount >= 200 && companyInfo.employeeCount <= 10000) {
        fitScore += 20;
        fitReasons.push(`Employee count (${companyInfo.employeeCount}) in sweet spot`);
      } else if (companyInfo.employeeCount > 10000) {
        fitScore += 15;
        fitReasons.push('Enterprise-scale company');
      } else if (companyInfo.employeeCount >= 50) {
        fitScore += 10;
        fitReasons.push('Growing mid-size company');
      } else {
        fitScore -= 10;
        fitReasons.push('Small company — limited budget potential');
      }
    }

    // Tech stack affinity
    if (companyInfo.techStack && companyInfo.techStack.length > 0) {
      const stackSize = companyInfo.techStack.length;
      fitScore += Math.min(15, stackSize * 3);
      fitReasons.push(`Tech stack with ${stackSize} known technologies`);
    }

    // Funding stage
    if (companyInfo.fundingStage) {
      const stage = companyInfo.fundingStage.toLowerCase();
      if (stage.includes('series c') || stage.includes('series d') || stage.includes('ipo') || stage.includes('public')) {
        fitScore += 15;
        fitReasons.push(`Late-stage / mature funding (${companyInfo.fundingStage})`);
      } else if (stage.includes('series b')) {
        fitScore += 10;
        fitReasons.push(`Growth-stage funding (${companyInfo.fundingStage})`);
      } else if (stage.includes('series a')) {
        fitScore += 5;
        fitReasons.push(`Early growth funding (${companyInfo.fundingStage})`);
      }
    }

    fitScore = clamp(fitScore, 0, 100);

    factors.push({
      name: 'ICP Fit',
      score: fitScore,
      weight: 0.30,
      reasoning: fitReasons.length > 0
        ? fitReasons.join('. ') + '.'
        : 'Baseline fit score applied.',
    });

    return fitScore;
  }

  private computeEngagementScore(signals: IntentSignal[], now: number, factors: ScoringFactor[]): number {
    if (signals.length === 0) {
      factors.push({
        name: 'Engagement',
        score: 0,
        weight: 0.25,
        reasoning: 'No engagement signals recorded.',
      });
      return 0;
    }

    const recentWindow = 30 * MS_PER_DAY;
    const recentSignals = signals.filter(s => (now - s.timestamp) < recentWindow);

    // Frequency component (up to 40 points)
    const frequencyScore = Math.min(40, recentSignals.length * 5);

    // Recency component (up to 30 points)
    const mostRecent = Math.max(...signals.map(s => s.timestamp));
    const daysSinceLast = (now - mostRecent) / MS_PER_DAY;
    const recencyScore = daysSinceLast < 1 ? 30
      : daysSinceLast < 3 ? 25
      : daysSinceLast < 7 ? 20
      : daysSinceLast < 14 ? 10
      : daysSinceLast < 30 ? 5
      : 0;

    // Depth component — how many different actions (up to 30 points)
    const uniqueActions = new Set(recentSignals.map(s => s.action)).size;
    const depthScore = Math.min(30, uniqueActions * 6);

    const engagement = clamp(frequencyScore + recencyScore + depthScore, 0, 100);

    const reasons: string[] = [];
    reasons.push(`${recentSignals.length} signal(s) in last 30 days`);
    if (daysSinceLast < 7) reasons.push(`Last activity ${daysSinceLast < 1 ? 'today' : `${Math.round(daysSinceLast)}d ago`}`);
    reasons.push(`${uniqueActions} unique action(s)`);

    factors.push({
      name: 'Engagement',
      score: engagement,
      weight: 0.25,
      reasoning: reasons.join('. ') + '.',
    });

    return engagement;
  }

  private emptyIntentScore(company: string, now: number): BuyerIntentScore {
    return {
      company,
      companyDomain: undefined,
      overallScore: 0,
      level: 'cold',
      trend: 'new',
      channelBreakdown: {},
      topActions: [],
      predictedTimeframe: 'unknown',
      confidenceLevel: 0,
      lastActivity: 0,
      scoredAt: now,
    };
  }
}

// ── Singleton export ─────────────────────────────────────────────────────────

export const buyerIntentEngine = new BuyerIntentEngine();
