/**
 * Deal Pipeline & CRM Integration Service
 *
 * Full-featured deal/opportunity management with pipeline analytics,
 * stage tracking, activity logging, revenue forecasting, and CRM export
 * capabilities (Salesforce, HubSpot, CSV, JSON).
 *
 * Persists all data via IndexedDB-backed persistent cache.
 */

import type { CompanySignal } from './signal-aggregator';
import { getPersistentCache, setPersistentCache } from './persistent-cache';

// ── Pipeline Stage Types ─────────────────────────────────────────────────────

export type PipelineStage =
  | 'prospecting'
  | 'qualification'
  | 'discovery'
  | 'proposal'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost';

export interface StageConfig {
  stage: PipelineStage;
  label: string;
  defaultProbability: number;
  order: number;
  isClosed: boolean;
}

export const STAGE_CONFIGS: readonly StageConfig[] = [
  { stage: 'prospecting',   label: 'Prospecting',   defaultProbability: 0.10, order: 0, isClosed: false },
  { stage: 'qualification', label: 'Qualification',  defaultProbability: 0.20, order: 1, isClosed: false },
  { stage: 'discovery',     label: 'Discovery',      defaultProbability: 0.40, order: 2, isClosed: false },
  { stage: 'proposal',      label: 'Proposal',       defaultProbability: 0.60, order: 3, isClosed: false },
  { stage: 'negotiation',   label: 'Negotiation',    defaultProbability: 0.80, order: 4, isClosed: false },
  { stage: 'closed_won',    label: 'Closed Won',     defaultProbability: 1.00, order: 5, isClosed: true  },
  { stage: 'closed_lost',   label: 'Closed Lost',    defaultProbability: 0.00, order: 6, isClosed: true  },
] as const;

const STAGE_ORDER_MAP: Record<PipelineStage, number> = Object.fromEntries(
  STAGE_CONFIGS.map(c => [c.stage, c.order]),
) as Record<PipelineStage, number>;

const STAGE_PROBABILITY_MAP: Record<PipelineStage, number> = Object.fromEntries(
  STAGE_CONFIGS.map(c => [c.stage, c.defaultProbability]),
) as Record<PipelineStage, number>;

const STAGE_LABEL_MAP: Record<PipelineStage, string> = Object.fromEntries(
  STAGE_CONFIGS.map(c => [c.stage, c.label]),
) as Record<PipelineStage, string>;

// ── Deal Activity Types ──────────────────────────────────────────────────────

export type DealActivityType =
  | 'created'
  | 'stage_change'
  | 'value_change'
  | 'note_added'
  | 'signal_added'
  | 'owner_change'
  | 'tag_added'
  | 'tag_removed'
  | 'contact_updated'
  | 'probability_change'
  | 'close_date_change'
  | 'deal_won'
  | 'deal_lost';

export interface DealActivity {
  id: string;
  dealId: string;
  type: DealActivityType;
  timestamp: string; // ISO 8601
  description: string;
  previousValue?: string;
  newValue?: string;
  metadata?: Record<string, string>;
}

// ── Deal / Opportunity Type ──────────────────────────────────────────────────

export interface Deal {
  id: string;
  company: string;
  companyDomain: string;
  contactName: string;
  contactEmail: string;
  dealValue: number;
  currency: string;
  stage: PipelineStage;
  probability: number;
  expectedCloseDate: string; // ISO 8601
  createdAt: string;         // ISO 8601
  updatedAt: string;         // ISO 8601
  owner: string;
  notes: string;
  signals: CompanySignal[];
  tags: string[];
  lostReason?: string;
  wonReason?: string;
  source: string;
  activities: DealActivity[];
}

export type CreateDealInput = Omit<Deal, 'id' | 'createdAt' | 'updatedAt' | 'activities' | 'probability'> & {
  probability?: number;
};

export type UpdateDealInput = Partial<Omit<Deal, 'id' | 'createdAt' | 'activities'>>;

// ── Analytics Types ──────────────────────────────────────────────────────────

export interface StageSummary {
  stage: PipelineStage;
  label: string;
  count: number;
  totalValue: number;
  weightedValue: number;
}

export interface PipelineMetrics {
  totalDeals: number;
  totalValue: number;
  weightedValue: number;
  dealsByStage: StageSummary[];
  avgDealSize: number;
  avgDaysInPipeline: number;
  winRate: number; // Last 90 days, 0-1
}

export interface QuarterlyBreakdown {
  quarter: string; // e.g. "2026-Q1"
  bestCase: number;
  expected: number;
  committed: number;
  dealCount: number;
}

export interface RevenueForecast {
  bestCase: number;
  expected: number;
  committed: number;
  quarterly: QuarterlyBreakdown[];
}

export interface StageConversionRate {
  fromStage: PipelineStage;
  toStage: PipelineStage;
  conversionRate: number; // 0-1
  sampleSize: number;
}

export interface StageVelocity {
  stage: PipelineStage;
  label: string;
  avgDays: number;
  medianDays: number;
  dealCount: number;
}

export interface VelocityMetrics {
  stageVelocity: StageVelocity[];
  overallAvgDays: number;
  bottleneck: {
    stage: PipelineStage;
    label: string;
    avgDays: number;
  } | null;
}

// ── CRM Export Types ─────────────────────────────────────────────────────────

export interface SalesforceOpportunity {
  Name: string;
  AccountName: string;
  Amount: number;
  CurrencyIsoCode: string;
  StageName: string;
  Probability: number;
  CloseDate: string;
  OwnerId: string;
  Description: string;
  LeadSource: string;
  ContactEmail: string;
  ContactName: string;
  Type: string;
  CreatedDate: string;
  LastModifiedDate: string;
  IsClosed: boolean;
  IsWon: boolean;
}

export interface HubSpotDeal {
  properties: {
    dealname: string;
    amount: string;
    dealstage: string;
    pipeline: string;
    closedate: string;
    hs_deal_stage_probability: string;
    hubspot_owner_id: string;
    description: string;
    deal_currency_code: string;
    createdate: string;
    hs_lastmodifieddate: string;
    dealtype: string;
    hs_deal_stage_probability_shadow: string;
  };
  associations: {
    contacts: { email: string; name: string }[];
    companies: { name: string; domain: string }[];
  };
}

// ── Serializable Deal (for persistence — CompanySignal.timestamp as string) ─

interface SerializedDeal extends Omit<Deal, 'signals'> {
  signals: SerializedCompanySignal[];
}

interface SerializedCompanySignal extends Omit<CompanySignal, 'timestamp'> {
  timestamp: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const CACHE_KEY = 'deal-pipeline:deals';

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 10);
  return `deal_${ts}_${rand}`;
}

function generateActivityId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `act_${ts}_${rand}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

function daysBetween(a: string, b: string): number {
  const msPerDay = 86_400_000;
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / msPerDay;
}

function getQuarterLabel(date: Date): string {
  const q = Math.ceil((date.getMonth() + 1) / 3);
  return `${date.getFullYear()}-Q${q}`;
}

function serializeSignals(signals: CompanySignal[]): SerializedCompanySignal[] {
  return signals.map(s => ({
    ...s,
    timestamp: s.timestamp instanceof Date ? s.timestamp.toISOString() : String(s.timestamp),
  }));
}

function deserializeSignals(signals: SerializedCompanySignal[]): CompanySignal[] {
  return signals.map(s => ({
    ...s,
    timestamp: new Date(s.timestamp),
  }));
}

function serializeDeal(deal: Deal): SerializedDeal {
  return {
    ...deal,
    signals: serializeSignals(deal.signals),
  };
}

function deserializeDeal(raw: SerializedDeal): Deal {
  return {
    ...raw,
    signals: deserializeSignals(raw.signals),
  };
}

/** Map our pipeline stages to Salesforce stage names. */
function toSalesforceStage(stage: PipelineStage): string {
  const map: Record<PipelineStage, string> = {
    prospecting: 'Prospecting',
    qualification: 'Qualification',
    discovery: 'Needs Analysis',
    proposal: 'Proposal/Price Quote',
    negotiation: 'Negotiation/Review',
    closed_won: 'Closed Won',
    closed_lost: 'Closed Lost',
  };
  return map[stage];
}

/** Map our pipeline stages to HubSpot deal stage identifiers. */
function toHubSpotStage(stage: PipelineStage): string {
  const map: Record<PipelineStage, string> = {
    prospecting: 'appointmentscheduled',
    qualification: 'qualifiedtobuy',
    discovery: 'presentationscheduled',
    proposal: 'decisionmakerboughtin',
    negotiation: 'contractsent',
    closed_won: 'closedwon',
    closed_lost: 'closedlost',
  };
  return map[stage];
}

function escapeCSVField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ── DealPipeline Class ───────────────────────────────────────────────────────

class DealPipeline {
  private deals: Map<string, Deal> = new Map();
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  // ── Initialization ────────────────────────────────────────────────────────

  /**
   * Load deals from persistent cache. Called lazily on first access.
   * Safe to call multiple times — initialization is idempotent.
   */
  private ensureInit(): Promise<void> {
    if (this.initialized) return Promise.resolve();
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.loadFromCache().then(() => {
      this.initialized = true;
    }).catch(err => {
      console.warn('[deal-pipeline] Failed to load from cache, starting fresh', err);
      this.initialized = true;
    });

    return this.initPromise;
  }

  private async loadFromCache(): Promise<void> {
    const envelope = await getPersistentCache<SerializedDeal[]>(CACHE_KEY);
    if (!envelope?.data) return;

    this.deals.clear();
    for (const raw of envelope.data) {
      const deal = deserializeDeal(raw);
      this.deals.set(deal.id, deal);
    }
  }

  private async persist(): Promise<void> {
    const serialized = Array.from(this.deals.values()).map(serializeDeal);
    await setPersistentCache(CACHE_KEY, serialized);
  }

  // ── Activity Logging ──────────────────────────────────────────────────────

  private addActivity(
    deal: Deal,
    type: DealActivityType,
    description: string,
    previousValue?: string,
    newValue?: string,
    metadata?: Record<string, string>,
  ): void {
    const activity: DealActivity = {
      id: generateActivityId(),
      dealId: deal.id,
      type,
      timestamp: nowISO(),
      description,
      previousValue,
      newValue,
      metadata,
    };
    deal.activities.push(activity);
  }

  // ── CRUD Operations ───────────────────────────────────────────────────────

  async createDeal(data: CreateDealInput): Promise<Deal> {
    await this.ensureInit();

    const now = nowISO();
    const id = generateId();
    const probability = data.probability ?? STAGE_PROBABILITY_MAP[data.stage];

    const deal: Deal = {
      id,
      company: data.company,
      companyDomain: data.companyDomain,
      contactName: data.contactName,
      contactEmail: data.contactEmail,
      dealValue: data.dealValue,
      currency: data.currency,
      stage: data.stage,
      probability,
      expectedCloseDate: data.expectedCloseDate,
      createdAt: now,
      updatedAt: now,
      owner: data.owner,
      notes: data.notes,
      signals: data.signals,
      tags: data.tags,
      lostReason: data.lostReason,
      wonReason: data.wonReason,
      source: data.source,
      activities: [],
    };

    this.addActivity(deal, 'created', `Deal created: ${data.company} — ${data.dealValue} ${data.currency}`);

    this.deals.set(id, deal);
    await this.persist();
    return deal;
  }

  async updateDeal(id: string, changes: UpdateDealInput): Promise<Deal> {
    await this.ensureInit();

    const deal = this.deals.get(id);
    if (!deal) {
      throw new Error(`[deal-pipeline] Deal not found: ${id}`);
    }

    // Track specific changes for the activity log
    if (changes.dealValue !== undefined && changes.dealValue !== deal.dealValue) {
      this.addActivity(
        deal, 'value_change',
        `Deal value changed from ${deal.dealValue} to ${changes.dealValue} ${deal.currency}`,
        String(deal.dealValue), String(changes.dealValue),
      );
    }

    if (changes.owner !== undefined && changes.owner !== deal.owner) {
      this.addActivity(
        deal, 'owner_change',
        `Owner changed from "${deal.owner}" to "${changes.owner}"`,
        deal.owner, changes.owner,
      );
    }

    if (changes.notes !== undefined && changes.notes !== deal.notes) {
      this.addActivity(deal, 'note_added', 'Notes updated');
    }

    if (changes.probability !== undefined && changes.probability !== deal.probability) {
      this.addActivity(
        deal, 'probability_change',
        `Probability changed from ${(deal.probability * 100).toFixed(0)}% to ${(changes.probability * 100).toFixed(0)}%`,
        String(deal.probability), String(changes.probability),
      );
    }

    if (changes.expectedCloseDate !== undefined && changes.expectedCloseDate !== deal.expectedCloseDate) {
      this.addActivity(
        deal, 'close_date_change',
        `Expected close date changed from ${deal.expectedCloseDate} to ${changes.expectedCloseDate}`,
        deal.expectedCloseDate, changes.expectedCloseDate,
      );
    }

    if (changes.tags !== undefined) {
      const added = changes.tags.filter(t => !deal.tags.includes(t));
      const removed = deal.tags.filter(t => !changes.tags!.includes(t));
      for (const tag of added) {
        this.addActivity(deal, 'tag_added', `Tag added: "${tag}"`, undefined, tag);
      }
      for (const tag of removed) {
        this.addActivity(deal, 'tag_removed', `Tag removed: "${tag}"`, tag, undefined);
      }
    }

    if (changes.signals !== undefined) {
      const existingIds = new Set(deal.signals.map(s => `${s.type}:${s.company}:${s.title}`));
      const newSignals = changes.signals.filter(s => !existingIds.has(`${s.type}:${s.company}:${s.title}`));
      for (const sig of newSignals) {
        this.addActivity(
          deal, 'signal_added',
          `Signal added: [${sig.type}] ${sig.title}`,
          undefined, sig.title,
          { signalType: sig.type, signalStrength: sig.strength },
        );
      }
    }

    if (changes.contactName !== undefined || changes.contactEmail !== undefined) {
      this.addActivity(deal, 'contact_updated', 'Contact information updated');
    }

    // Apply changes
    Object.assign(deal, changes, { updatedAt: nowISO() });
    await this.persist();
    return deal;
  }

  async moveDealToStage(id: string, stage: PipelineStage): Promise<Deal> {
    await this.ensureInit();

    const deal = this.deals.get(id);
    if (!deal) {
      throw new Error(`[deal-pipeline] Deal not found: ${id}`);
    }

    const previousStage = deal.stage;
    if (previousStage === stage) return deal;

    const previousLabel = STAGE_LABEL_MAP[previousStage];
    const newLabel = STAGE_LABEL_MAP[stage];

    deal.stage = stage;
    deal.probability = STAGE_PROBABILITY_MAP[stage];
    deal.updatedAt = nowISO();

    this.addActivity(
      deal, 'stage_change',
      `Stage changed from "${previousLabel}" to "${newLabel}"`,
      previousStage, stage,
    );

    if (stage === 'closed_won') {
      this.addActivity(deal, 'deal_won', `Deal won: ${deal.company} — ${deal.dealValue} ${deal.currency}`);
    } else if (stage === 'closed_lost') {
      this.addActivity(deal, 'deal_lost', `Deal lost: ${deal.company}`);
    }

    await this.persist();
    return deal;
  }

  async deleteDeal(id: string): Promise<boolean> {
    await this.ensureInit();

    const existed = this.deals.delete(id);
    if (existed) {
      await this.persist();
    }
    return existed;
  }

  async getDeal(id: string): Promise<Deal | null> {
    await this.ensureInit();
    return this.deals.get(id) ?? null;
  }

  async getDeals(): Promise<Deal[]> {
    await this.ensureInit();

    return Array.from(this.deals.values()).sort((a, b) => {
      const stageOrderDiff = STAGE_ORDER_MAP[a.stage] - STAGE_ORDER_MAP[b.stage];
      if (stageOrderDiff !== 0) return stageOrderDiff;
      return b.dealValue - a.dealValue;
    });
  }

  async getDealsByStage(stage: PipelineStage): Promise<Deal[]> {
    await this.ensureInit();

    return Array.from(this.deals.values())
      .filter(d => d.stage === stage)
      .sort((a, b) => b.dealValue - a.dealValue);
  }

  async getDealsByCompany(company: string): Promise<Deal[]> {
    await this.ensureInit();

    const normalized = company.trim().toLowerCase();
    return Array.from(this.deals.values())
      .filter(d => d.company.toLowerCase() === normalized)
      .sort((a, b) => b.dealValue - a.dealValue);
  }

  // ── Pipeline Analytics ────────────────────────────────────────────────────

  async getPipelineMetrics(): Promise<PipelineMetrics> {
    await this.ensureInit();

    const allDeals = Array.from(this.deals.values());
    const totalDeals = allDeals.length;

    if (totalDeals === 0) {
      return {
        totalDeals: 0,
        totalValue: 0,
        weightedValue: 0,
        dealsByStage: STAGE_CONFIGS.map(c => ({
          stage: c.stage,
          label: c.label,
          count: 0,
          totalValue: 0,
          weightedValue: 0,
        })),
        avgDealSize: 0,
        avgDaysInPipeline: 0,
        winRate: 0,
      };
    }

    let totalValue = 0;
    let weightedValue = 0;
    const stageMap = new Map<PipelineStage, { count: number; totalValue: number; weightedValue: number }>();

    // Initialize stage map
    for (const config of STAGE_CONFIGS) {
      stageMap.set(config.stage, { count: 0, totalValue: 0, weightedValue: 0 });
    }

    const now = Date.now();
    let totalDaysInPipeline = 0;
    let pipelineDealCount = 0;

    for (const deal of allDeals) {
      totalValue += deal.dealValue;
      weightedValue += deal.dealValue * deal.probability;

      const stageData = stageMap.get(deal.stage);
      if (stageData) {
        stageData.count += 1;
        stageData.totalValue += deal.dealValue;
        stageData.weightedValue += deal.dealValue * deal.probability;
      }

      // Days in pipeline (for non-closed deals, use now; for closed, use updatedAt)
      const isClosed = deal.stage === 'closed_won' || deal.stage === 'closed_lost';
      const endDate = isClosed ? deal.updatedAt : new Date(now).toISOString();
      totalDaysInPipeline += daysBetween(deal.createdAt, endDate);
      pipelineDealCount += 1;
    }

    // Win rate for last 90 days
    const ninetyDaysAgo = now - 90 * 86_400_000;
    const recentClosed = allDeals.filter(d => {
      const isRecentlyClosed = (d.stage === 'closed_won' || d.stage === 'closed_lost') &&
        new Date(d.updatedAt).getTime() >= ninetyDaysAgo;
      return isRecentlyClosed;
    });
    const recentWon = recentClosed.filter(d => d.stage === 'closed_won').length;
    const winRate = recentClosed.length > 0 ? recentWon / recentClosed.length : 0;

    const dealsByStage: StageSummary[] = STAGE_CONFIGS.map(c => {
      const data = stageMap.get(c.stage)!;
      return {
        stage: c.stage,
        label: c.label,
        count: data.count,
        totalValue: data.totalValue,
        weightedValue: data.weightedValue,
      };
    });

    return {
      totalDeals,
      totalValue,
      weightedValue,
      dealsByStage,
      avgDealSize: totalValue / totalDeals,
      avgDaysInPipeline: pipelineDealCount > 0 ? totalDaysInPipeline / pipelineDealCount : 0,
      winRate,
    };
  }

  async getRevenueForecasts(): Promise<RevenueForecast> {
    await this.ensureInit();

    const allDeals = Array.from(this.deals.values());
    const openDeals = allDeals.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost');

    let bestCase = 0;
    let expected = 0;
    let committed = 0;

    const quarterlyMap = new Map<string, { bestCase: number; expected: number; committed: number; dealCount: number }>();

    for (const deal of openDeals) {
      bestCase += deal.dealValue;
      expected += deal.dealValue * deal.probability;

      // Committed = negotiation stage or above (excluding closed_lost)
      if (STAGE_ORDER_MAP[deal.stage] >= STAGE_ORDER_MAP['negotiation']) {
        committed += deal.dealValue;
      }

      // Quarterly breakdown
      const closeDate = new Date(deal.expectedCloseDate);
      const qLabel = getQuarterLabel(closeDate);

      const existing = quarterlyMap.get(qLabel) ?? { bestCase: 0, expected: 0, committed: 0, dealCount: 0 };
      existing.bestCase += deal.dealValue;
      existing.expected += deal.dealValue * deal.probability;
      if (STAGE_ORDER_MAP[deal.stage] >= STAGE_ORDER_MAP['negotiation']) {
        existing.committed += deal.dealValue;
      }
      existing.dealCount += 1;
      quarterlyMap.set(qLabel, existing);
    }

    // Sort quarters chronologically
    const quarterly: QuarterlyBreakdown[] = Array.from(quarterlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([quarter, data]) => ({
        quarter,
        bestCase: data.bestCase,
        expected: data.expected,
        committed: data.committed,
        dealCount: data.dealCount,
      }));

    return { bestCase, expected, committed, quarterly };
  }

  async getStageConversionRates(): Promise<StageConversionRate[]> {
    await this.ensureInit();

    const allDeals = Array.from(this.deals.values());
    const conversions: StageConversionRate[] = [];

    // For each pair of adjacent stages, count how many deals passed through both
    const openStages = STAGE_CONFIGS.filter(c => !c.isClosed);

    for (let i = 0; i < openStages.length - 1; i++) {
      const fromStage = openStages[i]!.stage;
      const toStage = openStages[i + 1]!.stage;
      const fromOrder = STAGE_ORDER_MAP[fromStage];
      const toOrder = STAGE_ORDER_MAP[toStage];

      // Deals that reached at least the fromStage
      const reachedFrom = allDeals.filter(d => {
        const currentOrder = STAGE_ORDER_MAP[d.stage];
        // Deal is currently at or past the fromStage
        if (currentOrder >= fromOrder) return true;
        // Or it was lost after reaching fromStage — check activity log
        return d.activities.some(
          a => a.type === 'stage_change' && a.newValue !== undefined && STAGE_ORDER_MAP[a.newValue as PipelineStage] >= fromOrder,
        );
      });

      // Deals that reached at least the toStage
      const reachedTo = reachedFrom.filter(d => {
        const currentOrder = STAGE_ORDER_MAP[d.stage];
        if (currentOrder >= toOrder) return true;
        return d.activities.some(
          a => a.type === 'stage_change' && a.newValue !== undefined && STAGE_ORDER_MAP[a.newValue as PipelineStage] >= toOrder,
        );
      });

      conversions.push({
        fromStage,
        toStage,
        conversionRate: reachedFrom.length > 0 ? reachedTo.length / reachedFrom.length : 0,
        sampleSize: reachedFrom.length,
      });
    }

    // Also add conversion to closed_won from negotiation
    const reachedNegotiation = allDeals.filter(d => {
      const currentOrder = STAGE_ORDER_MAP[d.stage];
      if (currentOrder >= STAGE_ORDER_MAP['negotiation']) return true;
      return d.activities.some(
        a => a.type === 'stage_change' && a.newValue === 'negotiation',
      );
    });
    const closedWon = reachedNegotiation.filter(d => d.stage === 'closed_won');

    conversions.push({
      fromStage: 'negotiation',
      toStage: 'closed_won',
      conversionRate: reachedNegotiation.length > 0 ? closedWon.length / reachedNegotiation.length : 0,
      sampleSize: reachedNegotiation.length,
    });

    return conversions;
  }

  async getVelocityMetrics(): Promise<VelocityMetrics> {
    await this.ensureInit();

    const allDeals = Array.from(this.deals.values());

    // Compute average days spent in each stage from activity logs
    const stageTimings = new Map<PipelineStage, number[]>();
    for (const config of STAGE_CONFIGS) {
      stageTimings.set(config.stage, []);
    }

    for (const deal of allDeals) {
      // Build a timeline of stage transitions for this deal
      const transitions: { stage: PipelineStage; enteredAt: string }[] = [];

      // First stage entry is at creation
      transitions.push({ stage: deal.activities.find(a => a.type === 'created') ? deal.stage : deal.stage, enteredAt: deal.createdAt });

      // Walk through stage_change activities in chronological order
      const stageChanges = deal.activities
        .filter(a => a.type === 'stage_change' && a.previousValue !== undefined && a.newValue !== undefined)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // The deal started in the initial stage
      let currentStageEntry = deal.createdAt;
      let currentStage: PipelineStage = stageChanges.length > 0 && stageChanges[0]!.previousValue
        ? stageChanges[0]!.previousValue as PipelineStage
        : deal.stage;

      for (const change of stageChanges) {
        const daysInStage = daysBetween(currentStageEntry, change.timestamp);
        const timings = stageTimings.get(currentStage);
        if (timings) {
          timings.push(daysInStage);
        }
        currentStage = change.newValue as PipelineStage;
        currentStageEntry = change.timestamp;
      }

      // Time in current stage (up to now or close date)
      const isClosed = deal.stage === 'closed_won' || deal.stage === 'closed_lost';
      if (!isClosed) {
        const daysInCurrent = daysBetween(currentStageEntry, nowISO());
        const timings = stageTimings.get(deal.stage);
        if (timings) {
          timings.push(daysInCurrent);
        }
      }
    }

    const stageVelocity: StageVelocity[] = [];
    let overallTotalDays = 0;
    let overallCount = 0;

    for (const config of STAGE_CONFIGS) {
      const timings = stageTimings.get(config.stage) ?? [];
      const count = timings.length;
      const avgDays = count > 0 ? timings.reduce((sum, d) => sum + d, 0) / count : 0;
      const medianDays = count > 0 ? computeMedian(timings) : 0;

      stageVelocity.push({
        stage: config.stage,
        label: config.label,
        avgDays: Math.round(avgDays * 10) / 10,
        medianDays: Math.round(medianDays * 10) / 10,
        dealCount: count,
      });

      if (!config.isClosed && count > 0) {
        overallTotalDays += avgDays * count;
        overallCount += count;
      }
    }

    // Bottleneck: open stage with highest average days and at least one deal
    const openStageVelocities = stageVelocity.filter(sv =>
      sv.stage !== 'closed_won' && sv.stage !== 'closed_lost' && sv.dealCount > 0,
    );
    const bottleneckStage = openStageVelocities.length > 0
      ? openStageVelocities.reduce((max, sv) => sv.avgDays > max.avgDays ? sv : max, openStageVelocities[0]!)
      : null;

    return {
      stageVelocity,
      overallAvgDays: overallCount > 0 ? Math.round((overallTotalDays / overallCount) * 10) / 10 : 0,
      bottleneck: bottleneckStage
        ? { stage: bottleneckStage.stage, label: bottleneckStage.label, avgDays: bottleneckStage.avgDays }
        : null,
    };
  }

  // ── CRM Export ────────────────────────────────────────────────────────────

  async exportToSalesforceFormat(): Promise<SalesforceOpportunity[]> {
    await this.ensureInit();

    return Array.from(this.deals.values()).map((deal): SalesforceOpportunity => ({
      Name: `${deal.company} — ${deal.dealValue} ${deal.currency}`,
      AccountName: deal.company,
      Amount: deal.dealValue,
      CurrencyIsoCode: deal.currency,
      StageName: toSalesforceStage(deal.stage),
      Probability: Math.round(deal.probability * 100),
      CloseDate: deal.expectedCloseDate.split('T')[0] ?? deal.expectedCloseDate,
      OwnerId: deal.owner,
      Description: deal.notes,
      LeadSource: deal.source,
      ContactEmail: deal.contactEmail,
      ContactName: deal.contactName,
      Type: 'New Business',
      CreatedDate: deal.createdAt,
      LastModifiedDate: deal.updatedAt,
      IsClosed: deal.stage === 'closed_won' || deal.stage === 'closed_lost',
      IsWon: deal.stage === 'closed_won',
    }));
  }

  async exportToHubSpotFormat(): Promise<HubSpotDeal[]> {
    await this.ensureInit();

    return Array.from(this.deals.values()).map((deal): HubSpotDeal => ({
      properties: {
        dealname: `${deal.company} — ${deal.dealValue} ${deal.currency}`,
        amount: String(deal.dealValue),
        dealstage: toHubSpotStage(deal.stage),
        pipeline: 'default',
        closedate: new Date(deal.expectedCloseDate).getTime().toString(),
        hs_deal_stage_probability: String(deal.probability),
        hubspot_owner_id: deal.owner,
        description: deal.notes,
        deal_currency_code: deal.currency,
        createdate: new Date(deal.createdAt).getTime().toString(),
        hs_lastmodifieddate: new Date(deal.updatedAt).getTime().toString(),
        dealtype: 'newbusiness',
        hs_deal_stage_probability_shadow: String(deal.probability),
      },
      associations: {
        contacts: [{ email: deal.contactEmail, name: deal.contactName }],
        companies: [{ name: deal.company, domain: deal.companyDomain }],
      },
    }));
  }

  async exportToCSV(): Promise<string> {
    await this.ensureInit();

    const headers = [
      'ID', 'Company', 'Company Domain', 'Contact Name', 'Contact Email',
      'Deal Value', 'Currency', 'Stage', 'Probability', 'Expected Close Date',
      'Created At', 'Updated At', 'Owner', 'Source', 'Tags',
      'Won Reason', 'Lost Reason', 'Notes',
    ];

    const rows: string[] = [headers.map(escapeCSVField).join(',')];

    const deals = Array.from(this.deals.values()).sort((a, b) =>
      STAGE_ORDER_MAP[a.stage] - STAGE_ORDER_MAP[b.stage] || b.dealValue - a.dealValue,
    );

    for (const d of deals) {
      const row = [
        d.id,
        d.company,
        d.companyDomain,
        d.contactName,
        d.contactEmail,
        String(d.dealValue),
        d.currency,
        STAGE_LABEL_MAP[d.stage],
        `${(d.probability * 100).toFixed(0)}%`,
        d.expectedCloseDate.split('T')[0] ?? d.expectedCloseDate,
        d.createdAt,
        d.updatedAt,
        d.owner,
        d.source,
        d.tags.join('; '),
        d.wonReason ?? '',
        d.lostReason ?? '',
        d.notes,
      ].map(escapeCSVField);
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  async exportToJSON(): Promise<string> {
    await this.ensureInit();

    const deals = Array.from(this.deals.values()).sort((a, b) =>
      STAGE_ORDER_MAP[a.stage] - STAGE_ORDER_MAP[b.stage] || b.dealValue - a.dealValue,
    );

    const exportPayload = {
      exportedAt: nowISO(),
      totalDeals: deals.length,
      deals: deals.map(d => ({
        ...d,
        signals: d.signals.map(s => ({
          ...s,
          timestamp: s.timestamp instanceof Date ? s.timestamp.toISOString() : String(s.timestamp),
        })),
      })),
    };

    return JSON.stringify(exportPayload, null, 2);
  }
}

// ── Utility ──────────────────────────────────────────────────────────────────

function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

// ── Singleton Export ─────────────────────────────────────────────────────────

export const dealPipeline = new DealPipeline();
