/**
 * Competitive Intelligence Service — Battlecards, Win/Loss Analysis & Market Positioning
 *
 * Manages competitor tracking, battlecard generation, win/loss record keeping,
 * and competitive landscape analysis. Persists all data through the persistent
 * cache layer for cross-session durability.
 */

import type { CompanySignal } from './signal-aggregator';
import { getPersistentCache, setPersistentCache } from './persistent-cache';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MarketPosition = 'leader' | 'challenger' | 'niche' | 'emerging';

export type PricingModel = 'per_seat' | 'usage_based' | 'flat_rate' | 'tiered' | 'custom';

export type DifferentiatorAdvantage = 'us' | 'them' | 'tie';

export type WinLossOutcome = 'won' | 'lost';

export interface PricingInfo {
  model: PricingModel;
  startingPrice?: number;
  enterprisePrice?: number;
  freeTrialDays?: number;
  notes?: string;
}

export interface Competitor {
  id: string;
  name: string;
  domain: string;
  industry: string;
  description: string;
  strengths: string[];
  weaknesses: string[];
  pricing: PricingInfo;
  marketPosition: MarketPosition;
  lastUpdated: Date;
}

export interface Differentiator {
  feature: string;
  ours: string;
  theirs: string;
  advantage: DifferentiatorAdvantage;
}

export interface FeatureComparison {
  category: string;
  feature: string;
  us: boolean | string;
  them: boolean | string;
  notes?: string;
}

export interface ObjectionResponse {
  objection: string;
  response: string;
  evidence?: string;
}

export interface Testimonial {
  company: string;
  quote: string;
  role: string;
  context: string;
}

export interface Battlecard {
  id: string;
  competitor: Competitor;
  ourProduct: string;
  lastUpdated: Date;
  overview: string;
  keyDifferentiators: Differentiator[];
  commonObjections: ObjectionResponse[];
  winStrategies: string[];
  loseReasons: string[];
  talkTrack: string;
  competitivePositioning: string;
  customerTestimonials: Testimonial[];
  headToHead: FeatureComparison[];
}

export interface WinLossRecord {
  id: string;
  competitor: string;
  dealId?: string;
  dealValue?: number;
  outcome: WinLossOutcome;
  reason: string;
  date: Date;
  notes?: string;
  learnings: string[];
}

// ---------------------------------------------------------------------------
// Win/Loss Analysis result type
// ---------------------------------------------------------------------------

export interface WinLossAnalysis {
  competitor: string | null;
  totalDeals: number;
  wins: number;
  losses: number;
  winRate: number;
  totalValueWon: number;
  totalValueLost: number;
  topWinReasons: ReasonCount[];
  topLossReasons: ReasonCount[];
  recentTrend: WinLossOutcome[];
  learnings: string[];
}

export interface ReasonCount {
  reason: string;
  count: number;
  percentage: number;
}

// ---------------------------------------------------------------------------
// Competitive Landscape result type
// ---------------------------------------------------------------------------

export interface CompetitiveLandscape {
  generatedAt: Date;
  totalCompetitors: number;
  byPosition: Record<MarketPosition, Competitor[]>;
  featureMatrix: LandscapeFeatureRow[];
  marketOverview: string;
}

export interface LandscapeFeatureRow {
  feature: string;
  category: string;
  /** Our support for this feature */
  us: boolean | string;
  /** Keyed by competitor id */
  competitors: Record<string, boolean | string>;
}

// ---------------------------------------------------------------------------
// Competitor mention search result
// ---------------------------------------------------------------------------

export interface CompetitorMention {
  competitor: Competitor;
  signal: CompanySignal;
  mentionContext: string;
}

// ---------------------------------------------------------------------------
// Serializable versions of types with Date fields (for persistence)
// ---------------------------------------------------------------------------

interface SerializedCompetitor extends Omit<Competitor, 'lastUpdated'> {
  lastUpdated: string;
}

interface SerializedBattlecard extends Omit<Battlecard, 'lastUpdated' | 'competitor'> {
  lastUpdated: string;
  competitor: SerializedCompetitor;
}

interface SerializedWinLossRecord extends Omit<WinLossRecord, 'date'> {
  date: string;
}

// ---------------------------------------------------------------------------
// Persistence keys
// ---------------------------------------------------------------------------

const CACHE_KEY_COMPETITORS = 'competitive-intel:competitors';
const CACHE_KEY_BATTLECARDS = 'competitive-intel:battlecards';
const CACHE_KEY_WIN_LOSS = 'competitive-intel:win-loss';
const CACHE_KEY_OUR_PRODUCT = 'competitive-intel:our-product';

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

let idCounter = 0;

function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const counter = (idCounter++).toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${counter}_${random}`;
}

// ---------------------------------------------------------------------------
// Serialization helpers
// ---------------------------------------------------------------------------

function serializeCompetitor(c: Competitor): SerializedCompetitor {
  return { ...c, lastUpdated: c.lastUpdated.toISOString() };
}

function deserializeCompetitor(c: SerializedCompetitor): Competitor {
  return { ...c, lastUpdated: new Date(c.lastUpdated) };
}

function serializeBattlecard(b: Battlecard): SerializedBattlecard {
  return {
    ...b,
    lastUpdated: b.lastUpdated.toISOString(),
    competitor: serializeCompetitor(b.competitor),
  };
}

function deserializeBattlecard(b: SerializedBattlecard): Battlecard {
  return {
    ...b,
    lastUpdated: new Date(b.lastUpdated),
    competitor: deserializeCompetitor(b.competitor),
  };
}

function serializeWinLoss(r: WinLossRecord): SerializedWinLossRecord {
  return { ...r, date: r.date.toISOString() };
}

function deserializeWinLoss(r: SerializedWinLossRecord): WinLossRecord {
  return { ...r, date: new Date(r.date) };
}

// ---------------------------------------------------------------------------
// Built-in battlecard template helper
// ---------------------------------------------------------------------------

/**
 * Create an initial battlecard framework for a competitor.
 * Provides a structured skeleton that can be filled in with actual intelligence.
 */
function buildBattlecardTemplate(competitor: Competitor, ourProduct: string): Battlecard {
  const positionDescriptions: Record<MarketPosition, string> = {
    leader: `${competitor.name} is a market leader with established presence. Focus on innovation speed, flexibility, and modern architecture advantages.`,
    challenger: `${competitor.name} is an aggressive challenger. Highlight stability, ecosystem breadth, and proven enterprise track record.`,
    niche: `${competitor.name} serves a niche segment. Emphasize breadth of platform, integration capabilities, and total cost of ownership.`,
    emerging: `${competitor.name} is an emerging player. Leverage maturity, customer base size, and production-proven reliability.`,
  };

  const defaultObjections: ObjectionResponse[] = [
    {
      objection: `${competitor.name} is cheaper`,
      response: `While ${competitor.name} may have a lower sticker price, consider total cost of ownership including implementation, maintenance, and scaling costs. ${ourProduct} delivers faster time-to-value and lower operational overhead.`,
      evidence: 'Reference customer case studies showing TCO comparison over 3 years.',
    },
    {
      objection: `We already use ${competitor.name}`,
      response: `Many of our customers migrated from ${competitor.name}. The transition is smooth and the ROI typically pays for itself within the first quarter. We can share migration playbooks and customer references.`,
      evidence: 'Reference migration success stories and average ROI timeline.',
    },
    {
      objection: `${competitor.name} has feature X that you don't`,
      response: `We take a different approach to solving that problem, which our customers find more effective. Let me walk you through how our solution addresses the same underlying need.`,
    },
  ];

  const defaultWinStrategies: string[] = [
    `Lead with a live demo showing capabilities where ${ourProduct} clearly outperforms ${competitor.name}.`,
    `Bring in a reference customer who switched from ${competitor.name} to speak to the evaluation committee.`,
    `Focus on the total cost of ownership narrative rather than feature-by-feature comparison.`,
    `Identify the champion early and arm them with internal positioning materials.`,
    `Map ${competitor.name}'s known weaknesses to the prospect's stated requirements.`,
  ];

  const defaultLoseReasons: string[] = [
    'Price sensitivity without adequate TCO education.',
    `Pre-existing relationship or contract lock-in with ${competitor.name}.`,
    'Failed to engage the economic buyer early enough.',
    `${competitor.name} offered aggressive discounting or bundled pricing.`,
    'Prospect requirements aligned more closely with competitor strengths.',
  ];

  const defaultDifferentiators: Differentiator[] = competitor.strengths.map((strength) => ({
    feature: strength,
    ours: 'Evaluate and document our position',
    theirs: strength,
    advantage: 'them' as DifferentiatorAdvantage,
  }));

  // Also add differentiators from their weaknesses (our advantages)
  const weaknessDifferentiators: Differentiator[] = competitor.weaknesses.map((weakness) => ({
    feature: weakness.replace(/^(Lack of |No |Poor |Limited )/, ''),
    ours: 'Strong capability — document specifics',
    theirs: weakness,
    advantage: 'us' as DifferentiatorAdvantage,
  }));

  return {
    id: generateId('bc'),
    competitor,
    ourProduct,
    lastUpdated: new Date(),
    overview: `Competitive overview for ${competitor.name} (${competitor.domain}). ${competitor.description} They are positioned as a ${competitor.marketPosition} in the ${competitor.industry} space.`,
    keyDifferentiators: [...defaultDifferentiators, ...weaknessDifferentiators],
    commonObjections: defaultObjections,
    winStrategies: defaultWinStrategies,
    loseReasons: defaultLoseReasons,
    talkTrack: buildDefaultTalkTrack(competitor, ourProduct),
    competitivePositioning: positionDescriptions[competitor.marketPosition],
    customerTestimonials: [],
    headToHead: [],
  };
}

function buildDefaultTalkTrack(competitor: Competitor, ourProduct: string): string {
  const strengthsList = competitor.strengths.length > 0
    ? competitor.strengths.slice(0, 3).join(', ')
    : 'their market presence';

  const weaknessesList = competitor.weaknesses.length > 0
    ? competitor.weaknesses.slice(0, 3).join(', ')
    : 'areas where we differentiate';

  return [
    `OPENING: "I understand you may be looking at ${competitor.name}. Great company — they're known for ${strengthsList}."`,
    `BRIDGE: "Where customers tell us ${ourProduct} stands apart is in addressing ${weaknessesList}."`,
    `PROOF: "For example, [reference a specific customer story or metric]."`,
    `DIFFERENTIATION: "The key difference is [articulate core architectural or approach difference]."`,
    `CLOSE: "Would it be helpful to connect you with a customer who evaluated both solutions?"`,
  ].join('\n\n');
}

// ---------------------------------------------------------------------------
// CompetitiveIntelligenceManager
// ---------------------------------------------------------------------------

export class CompetitiveIntelligenceManager {
  private competitors: Map<string, Competitor> = new Map();
  private battlecards: Map<string, Battlecard> = new Map();
  private winLossRecords: WinLossRecord[] = [];
  private ourProduct = 'Our Product';
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  // ---- Initialization / Persistence ------------------------------------

  /**
   * Lazily load persisted state from cache. Idempotent — safe to call many times.
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._loadFromCache();
    await this.initPromise;
    this.initialized = true;
  }

  private async _loadFromCache(): Promise<void> {
    try {
      const [competitorsEnv, battlecardsEnv, winLossEnv, productEnv] = await Promise.all([
        getPersistentCache<SerializedCompetitor[]>(CACHE_KEY_COMPETITORS),
        getPersistentCache<SerializedBattlecard[]>(CACHE_KEY_BATTLECARDS),
        getPersistentCache<SerializedWinLossRecord[]>(CACHE_KEY_WIN_LOSS),
        getPersistentCache<string>(CACHE_KEY_OUR_PRODUCT),
      ]);

      if (competitorsEnv?.data) {
        for (const sc of competitorsEnv.data) {
          const c = deserializeCompetitor(sc);
          this.competitors.set(c.id, c);
        }
      }

      if (battlecardsEnv?.data) {
        for (const sb of battlecardsEnv.data) {
          const b = deserializeBattlecard(sb);
          this.battlecards.set(b.competitor.id, b);
        }
      }

      if (winLossEnv?.data) {
        this.winLossRecords = winLossEnv.data.map(deserializeWinLoss);
      }

      if (productEnv?.data) {
        this.ourProduct = productEnv.data;
      }
    } catch (error) {
      console.warn('[competitive-intel] Failed to load cached data:', error);
    }
  }

  private async persistCompetitors(): Promise<void> {
    const serialized = Array.from(this.competitors.values()).map(serializeCompetitor);
    await setPersistentCache(CACHE_KEY_COMPETITORS, serialized);
  }

  private async persistBattlecards(): Promise<void> {
    const serialized = Array.from(this.battlecards.values()).map(serializeBattlecard);
    await setPersistentCache(CACHE_KEY_BATTLECARDS, serialized);
  }

  private async persistWinLoss(): Promise<void> {
    const serialized = this.winLossRecords.map(serializeWinLoss);
    await setPersistentCache(CACHE_KEY_WIN_LOSS, serialized);
  }

  private async persistOurProduct(): Promise<void> {
    await setPersistentCache(CACHE_KEY_OUR_PRODUCT, this.ourProduct);
  }

  // ---- Our Product Configuration ----------------------------------------

  /**
   * Set the name of our product (used in battlecard generation).
   */
  async setOurProduct(name: string): Promise<void> {
    await this.ensureInitialized();
    this.ourProduct = name;
    await this.persistOurProduct();
  }

  getOurProductName(): string {
    return this.ourProduct;
  }

  // ---- Competitor CRUD --------------------------------------------------

  /**
   * Track a new competitor. Returns the newly created Competitor with a generated ID.
   */
  async addCompetitor(
    data: Omit<Competitor, 'id' | 'lastUpdated'>,
  ): Promise<Competitor> {
    await this.ensureInitialized();

    const competitor: Competitor = {
      ...data,
      id: generateId('comp'),
      lastUpdated: new Date(),
    };

    this.competitors.set(competitor.id, competitor);
    await this.persistCompetitors();
    return competitor;
  }

  /**
   * Update an existing competitor. Merges partial changes and bumps lastUpdated.
   * Returns the updated Competitor, or null if the ID was not found.
   */
  async updateCompetitor(
    id: string,
    changes: Partial<Omit<Competitor, 'id' | 'lastUpdated'>>,
  ): Promise<Competitor | null> {
    await this.ensureInitialized();

    const existing = this.competitors.get(id);
    if (!existing) return null;

    const updated: Competitor = {
      ...existing,
      ...changes,
      id: existing.id,
      lastUpdated: new Date(),
    };

    this.competitors.set(id, updated);

    // If this competitor has a battlecard, update the competitor reference there too
    const battlecard = this.battlecards.get(id);
    if (battlecard) {
      battlecard.competitor = updated;
      battlecard.lastUpdated = new Date();
      await Promise.all([this.persistCompetitors(), this.persistBattlecards()]);
    } else {
      await this.persistCompetitors();
    }

    return updated;
  }

  /**
   * Stop tracking a competitor. Also removes associated battlecard.
   * Returns true if the competitor existed and was removed.
   */
  async removeCompetitor(id: string): Promise<boolean> {
    await this.ensureInitialized();

    const existed = this.competitors.delete(id);
    if (!existed) return false;

    const hadBattlecard = this.battlecards.delete(id);

    const persistTasks: Promise<void>[] = [this.persistCompetitors()];
    if (hadBattlecard) {
      persistTasks.push(this.persistBattlecards());
    }
    await Promise.all(persistTasks);

    return true;
  }

  /**
   * Retrieve a single competitor by ID.
   */
  async getCompetitor(id: string): Promise<Competitor | null> {
    await this.ensureInitialized();
    return this.competitors.get(id) ?? null;
  }

  /**
   * List all tracked competitors, sorted alphabetically by name.
   */
  async listCompetitors(): Promise<Competitor[]> {
    await this.ensureInitialized();
    return Array.from(this.competitors.values())
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // ---- Battlecard Management --------------------------------------------

  /**
   * Generate a new battlecard for a competitor. If one already exists, it is
   * replaced with a fresh template. Returns the generated Battlecard.
   */
  async createBattlecard(competitorId: string): Promise<Battlecard | null> {
    await this.ensureInitialized();

    const competitor = this.competitors.get(competitorId);
    if (!competitor) return null;

    const battlecard = buildBattlecardTemplate(competitor, this.ourProduct);
    this.battlecards.set(competitorId, battlecard);
    await this.persistBattlecards();
    return battlecard;
  }

  /**
   * Update an existing battlecard with partial changes.
   * Returns the updated Battlecard, or null if not found.
   */
  async updateBattlecard(
    id: string,
    changes: Partial<Omit<Battlecard, 'id' | 'competitor' | 'lastUpdated'>>,
  ): Promise<Battlecard | null> {
    await this.ensureInitialized();

    // Find the battlecard by its own id
    let targetCompetitorId: string | null = null;
    for (const [compId, bc] of this.battlecards) {
      if (bc.id === id) {
        targetCompetitorId = compId;
        break;
      }
    }

    if (!targetCompetitorId) return null;

    const existing = this.battlecards.get(targetCompetitorId)!;
    const updated: Battlecard = {
      ...existing,
      ...changes,
      id: existing.id,
      competitor: existing.competitor,
      lastUpdated: new Date(),
    };

    this.battlecards.set(targetCompetitorId, updated);
    await this.persistBattlecards();
    return updated;
  }

  /**
   * Retrieve the battlecard for a given competitor.
   */
  async getBattlecard(competitorId: string): Promise<Battlecard | null> {
    await this.ensureInitialized();
    return this.battlecards.get(competitorId) ?? null;
  }

  // ---- Win/Loss Tracking ------------------------------------------------

  /**
   * Record a deal outcome against a competitor.
   * Generates an ID if not provided.
   */
  async recordWinLoss(
    record: Omit<WinLossRecord, 'id'> & { id?: string },
  ): Promise<WinLossRecord> {
    await this.ensureInitialized();

    const winLoss: WinLossRecord = {
      ...record,
      id: record.id ?? generateId('wl'),
      date: record.date instanceof Date ? record.date : new Date(record.date),
    };

    this.winLossRecords.push(winLoss);
    await this.persistWinLoss();
    return winLoss;
  }

  /**
   * Analyse win/loss records. If competitorId is provided, scopes to that
   * competitor; otherwise analyses across all competitors.
   */
  async getWinLossAnalysis(competitorId?: string): Promise<WinLossAnalysis> {
    await this.ensureInitialized();

    const records = competitorId
      ? this.winLossRecords.filter((r) => r.competitor === competitorId)
      : this.winLossRecords;

    const wins = records.filter((r) => r.outcome === 'won');
    const losses = records.filter((r) => r.outcome === 'lost');

    const totalDeals = records.length;
    const winRate = totalDeals > 0 ? wins.length / totalDeals : 0;

    const totalValueWon = wins.reduce((sum, r) => sum + (r.dealValue ?? 0), 0);
    const totalValueLost = losses.reduce((sum, r) => sum + (r.dealValue ?? 0), 0);

    // Count win reasons
    const winReasonCounts = new Map<string, number>();
    for (const w of wins) {
      const current = winReasonCounts.get(w.reason) ?? 0;
      winReasonCounts.set(w.reason, current + 1);
    }

    const topWinReasons: ReasonCount[] = Array.from(winReasonCounts.entries())
      .map(([reason, count]) => ({
        reason,
        count,
        percentage: wins.length > 0 ? (count / wins.length) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Count loss reasons
    const lossReasonCounts = new Map<string, number>();
    for (const l of losses) {
      const current = lossReasonCounts.get(l.reason) ?? 0;
      lossReasonCounts.set(l.reason, current + 1);
    }

    const topLossReasons: ReasonCount[] = Array.from(lossReasonCounts.entries())
      .map(([reason, count]) => ({
        reason,
        count,
        percentage: losses.length > 0 ? (count / losses.length) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Recent trend — last 10 outcomes, most recent first
    const sorted = [...records].sort(
      (a, b) => b.date.getTime() - a.date.getTime(),
    );
    const recentTrend: WinLossOutcome[] = sorted.slice(0, 10).map((r) => r.outcome);

    // Aggregate learnings (deduplicated)
    const learningSet = new Set<string>();
    for (const r of records) {
      for (const l of r.learnings) {
        learningSet.add(l);
      }
    }

    return {
      competitor: competitorId ?? null,
      totalDeals,
      wins: wins.length,
      losses: losses.length,
      winRate,
      totalValueWon,
      totalValueLost,
      topWinReasons,
      topLossReasons,
      recentTrend,
      learnings: Array.from(learningSet),
    };
  }

  // ---- Competitive Landscape --------------------------------------------

  /**
   * Generate a market overview: competitors grouped by position, plus
   * a consolidated feature matrix derived from all battlecard head-to-head data.
   */
  async getCompetitiveLandscape(): Promise<CompetitiveLandscape> {
    await this.ensureInitialized();

    const allCompetitors = Array.from(this.competitors.values());

    const byPosition: Record<MarketPosition, Competitor[]> = {
      leader: [],
      challenger: [],
      niche: [],
      emerging: [],
    };

    for (const c of allCompetitors) {
      byPosition[c.marketPosition].push(c);
    }

    // Sort each position group alphabetically
    for (const position of Object.keys(byPosition) as MarketPosition[]) {
      byPosition[position].sort((a, b) => a.name.localeCompare(b.name));
    }

    // Build consolidated feature matrix from all battlecards
    const featureMatrix: LandscapeFeatureRow[] = [];
    const featureIndex = new Map<string, LandscapeFeatureRow>();

    for (const [compId, bc] of this.battlecards) {
      for (const comparison of bc.headToHead) {
        const featureKey = `${comparison.category}::${comparison.feature}`;
        let row = featureIndex.get(featureKey);

        if (!row) {
          row = {
            feature: comparison.feature,
            category: comparison.category,
            us: comparison.us,
            competitors: {},
          };
          featureIndex.set(featureKey, row);
          featureMatrix.push(row);
        }

        row.competitors[compId] = comparison.them;
      }
    }

    // Sort feature matrix by category then feature name
    featureMatrix.sort((a, b) => {
      const catCmp = a.category.localeCompare(b.category);
      if (catCmp !== 0) return catCmp;
      return a.feature.localeCompare(b.feature);
    });

    // Build market overview narrative
    const positionSummaries: string[] = [];
    for (const position of ['leader', 'challenger', 'niche', 'emerging'] as MarketPosition[]) {
      const group = byPosition[position];
      if (group.length > 0) {
        const names = group.map((c) => c.name).join(', ');
        positionSummaries.push(`${capitalize(position)}s: ${names}`);
      }
    }

    const winLossAnalysis = await this.getWinLossAnalysis();
    const winRateStr = winLossAnalysis.totalDeals > 0
      ? ` Overall win rate: ${(winLossAnalysis.winRate * 100).toFixed(0)}% across ${winLossAnalysis.totalDeals} deals.`
      : '';

    const marketOverview = allCompetitors.length > 0
      ? `Competitive landscape includes ${allCompetitors.length} tracked competitor${allCompetitors.length !== 1 ? 's' : ''}. ${positionSummaries.join('. ')}.${winRateStr}`
      : 'No competitors are currently being tracked.';

    return {
      generatedAt: new Date(),
      totalCompetitors: allCompetitors.length,
      byPosition,
      featureMatrix,
      marketOverview,
    };
  }

  // ---- Signal Scanning --------------------------------------------------

  /**
   * Scan an array of CompanySignals for mentions of any tracked competitor.
   * Returns matches keyed by competitor, with context about the mention.
   */
  async searchCompetitorMentions(
    signals: CompanySignal[],
  ): Promise<CompetitorMention[]> {
    await this.ensureInitialized();

    const mentions: CompetitorMention[] = [];
    const competitors = Array.from(this.competitors.values());

    if (competitors.length === 0 || signals.length === 0) return mentions;

    for (const signal of signals) {
      const searchText = [
        signal.title,
        signal.summary ?? '',
        signal.company,
        signal.source,
      ].join(' ').toLowerCase();

      for (const competitor of competitors) {
        const nameMatch = searchText.includes(competitor.name.toLowerCase());
        const domainMatch = competitor.domain.length > 0
          && searchText.includes(competitor.domain.toLowerCase());

        if (nameMatch || domainMatch) {
          const matchedOn = nameMatch ? competitor.name : competitor.domain;
          mentions.push({
            competitor,
            signal,
            mentionContext: `Competitor "${competitor.name}" mentioned in ${signal.type} signal: "${signal.title}" (matched on: ${matchedOn})`,
          });
        }
      }
    }

    // Sort by signal strength (critical first) then recency
    const strengthOrder: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    mentions.sort((a, b) => {
      const strengthDiff = (strengthOrder[a.signal.strength] ?? 4) - (strengthOrder[b.signal.strength] ?? 4);
      if (strengthDiff !== 0) return strengthDiff;
      return b.signal.timestamp.getTime() - a.signal.timestamp.getTime();
    });

    return mentions;
  }

  // ---- Competitive Positioning Generation --------------------------------

  /**
   * Auto-generate a competitive positioning statement for a specific competitor.
   * Uses tracked competitor data, battlecard info, and win/loss history.
   */
  async generateCompetitivePositioning(competitorId: string): Promise<string | null> {
    await this.ensureInitialized();

    const competitor = this.competitors.get(competitorId);
    if (!competitor) return null;

    const battlecard = this.battlecards.get(competitorId);
    const winLoss = await this.getWinLossAnalysis(competitorId);

    // Build positioning from available data
    const sections: string[] = [];

    // Opening
    sections.push(
      `COMPETITIVE POSITIONING vs. ${competitor.name.toUpperCase()}`,
    );
    sections.push('='.repeat(50));

    // Market position context
    sections.push(
      `\nMarket Position: ${capitalize(competitor.marketPosition)}`,
    );
    sections.push(`Industry: ${competitor.industry}`);
    sections.push(`Domain: ${competitor.domain}`);

    // Pricing intelligence
    const pricingDesc = describePricing(competitor.pricing);
    if (pricingDesc) {
      sections.push(`\nPricing: ${pricingDesc}`);
    }

    // Their strengths (acknowledge honestly)
    if (competitor.strengths.length > 0) {
      sections.push('\nWhere they are strong:');
      for (const s of competitor.strengths) {
        sections.push(`  - ${s}`);
      }
    }

    // Their weaknesses (our opportunity)
    if (competitor.weaknesses.length > 0) {
      sections.push('\nWhere we differentiate:');
      for (const w of competitor.weaknesses) {
        sections.push(`  - ${w}`);
      }
    }

    // Win/loss data
    if (winLoss.totalDeals > 0) {
      sections.push(
        `\nHead-to-head record: ${winLoss.wins}W / ${winLoss.losses}L (${(winLoss.winRate * 100).toFixed(0)}% win rate)`,
      );

      if (winLoss.topWinReasons.length > 0) {
        sections.push('Top reasons we win:');
        for (const r of winLoss.topWinReasons.slice(0, 3)) {
          sections.push(`  - ${r.reason} (${r.percentage.toFixed(0)}% of wins)`);
        }
      }

      if (winLoss.topLossReasons.length > 0) {
        sections.push('Top reasons we lose:');
        for (const r of winLoss.topLossReasons.slice(0, 3)) {
          sections.push(`  - ${r.reason} (${r.percentage.toFixed(0)}% of losses)`);
        }
      }
    }

    // Key differentiators from battlecard
    if (battlecard) {
      const ourAdvantages = battlecard.keyDifferentiators.filter(
        (d) => d.advantage === 'us',
      );
      if (ourAdvantages.length > 0) {
        sections.push('\nKey differentiators in our favor:');
        for (const d of ourAdvantages.slice(0, 5)) {
          sections.push(`  - ${d.feature}: ${d.ours} vs. their "${d.theirs}"`);
        }
      }
    }

    // Positioning statement
    sections.push('\n--- POSITIONING STATEMENT ---');
    sections.push(buildPositioningStatement(competitor, this.ourProduct, winLoss));

    return sections.join('\n');
  }
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function describePricing(pricing: PricingInfo): string {
  const modelLabels: Record<PricingModel, string> = {
    per_seat: 'Per-seat',
    usage_based: 'Usage-based',
    flat_rate: 'Flat rate',
    tiered: 'Tiered',
    custom: 'Custom / quote-based',
  };

  const parts: string[] = [modelLabels[pricing.model]];

  if (pricing.startingPrice !== undefined) {
    parts.push(`starting at $${pricing.startingPrice.toLocaleString()}`);
  }

  if (pricing.enterprisePrice !== undefined) {
    parts.push(`enterprise at $${pricing.enterprisePrice.toLocaleString()}`);
  }

  if (pricing.freeTrialDays !== undefined && pricing.freeTrialDays > 0) {
    parts.push(`${pricing.freeTrialDays}-day free trial`);
  }

  if (pricing.notes) {
    parts.push(`(${pricing.notes})`);
  }

  return parts.join(', ');
}

function buildPositioningStatement(
  competitor: Competitor,
  ourProduct: string,
  winLoss: WinLossAnalysis,
): string {
  const winRateContext = winLoss.totalDeals > 0
    ? ` Our ${(winLoss.winRate * 100).toFixed(0)}% win rate against them demonstrates this advantage in practice.`
    : '';

  const topStrength = competitor.weaknesses[0] ?? 'key areas of differentiation';
  const theirStrength = competitor.strengths[0] ?? 'certain capabilities';

  return `When prospects are evaluating ${competitor.name}, position ${ourProduct} around ${topStrength}. ` +
    `Acknowledge that ${competitor.name} is known for ${theirStrength}, but redirect the conversation ` +
    `to the areas where ${ourProduct} delivers superior outcomes.${winRateContext} ` +
    `Always lead with customer evidence and concrete ROI metrics rather than feature comparisons.`;
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const competitiveIntel = new CompetitiveIntelligenceManager();
