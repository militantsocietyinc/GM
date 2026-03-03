/**
 * Email Sequence Automation Service
 *
 * Multi-step email sequence management for sales outreach.
 * Supports conditional branching, A/B testing, per-step analytics,
 * and built-in templates for common outreach patterns.
 */

import type { OutreachTemplate } from './outreach-generator';
import { getPersistentCache, setPersistentCache } from './persistent-cache';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StepStats {
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
}

export interface EmailStep {
  id: string;
  order: number;
  subject: string;
  body: string;
  /** Days to wait after previous step before sending */
  delayDays: number;
  template: OutreachTemplate;
  /** Whether this step only fires based on a condition from the previous step */
  isConditional: boolean;
  conditionType: 'opened' | 'clicked' | 'replied' | 'none';
  /** Step to jump to when the condition is NOT met */
  fallbackStepId?: string;
  /** A/B variant label for split testing */
  abVariant?: 'A' | 'B';
  stepStats: StepStats;
}

export interface ContactResponse {
  type: 'open' | 'click' | 'reply' | 'bounce';
  stepId: string;
  timestamp: string;
  detail?: string;
}

export interface SequenceContact {
  email: string;
  name: string;
  company: string;
  /** The step order number the contact is currently on (0-indexed) */
  currentStep: number;
  status: 'active' | 'completed' | 'replied' | 'bounced' | 'unsubscribed' | 'paused';
  enrolledAt: string;
  lastStepSentAt: string | null;
  nextStepDue: string | null;
  responses: ContactResponse[];
}

export interface SequenceStats {
  totalEnrolled: number;
  active: number;
  completed: number;
  replied: number;
  bounced: number;
  unsubscribed: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  /** Average time (in hours) between send and first reply */
  avgResponseTime: number;
}

export type SequenceStatus = 'draft' | 'active' | 'paused' | 'completed';

export interface EmailSequence {
  id: string;
  name: string;
  description: string;
  steps: EmailStep[];
  targetContacts: SequenceContact[];
  status: SequenceStatus;
  createdAt: string;
  updatedAt: string;
  stats: SequenceStats;
  tags: string[];
}

// ---------------------------------------------------------------------------
// Input/partial types used by the manager API
// ---------------------------------------------------------------------------

export type CreateSequenceData = Pick<EmailSequence, 'name' | 'description' | 'tags'> & {
  steps?: Omit<EmailStep, 'id' | 'stepStats'>[];
};

export type UpdateSequenceData = Partial<Pick<EmailSequence, 'name' | 'description' | 'tags' | 'status'>>;

export type AddStepData = Omit<EmailStep, 'id' | 'stepStats'>;

export type EnrollContactData = Pick<SequenceContact, 'email' | 'name' | 'company'>;

export interface ScheduledAction {
  sequenceId: string;
  sequenceName: string;
  contact: SequenceContact;
  step: EmailStep;
}

export interface StepAnalytics {
  stepId: string;
  order: number;
  subject: string;
  stats: StepStats;
  openRate: number;
  clickRate: number;
  replyRate: number;
  bounceRate: number;
}

export interface ABComparison {
  stepOrder: number;
  variantA: StepAnalytics | null;
  variantB: StepAnalytics | null;
  winner: 'A' | 'B' | 'inconclusive';
}

export interface SequenceAnalytics {
  sequenceId: string;
  sequenceName: string;
  overallStats: SequenceStats;
  perStep: StepAnalytics[];
  abComparisons: ABComparison[];
  /** Average number of steps completed before a contact exits */
  avgStepsCompleted: number;
  /** Contacts that completed the full sequence */
  completionRate: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CACHE_KEY = 'email-sequences';

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

function emptyStepStats(): StepStats {
  return { sent: 0, opened: 0, clicked: 0, replied: 0, bounced: 0 };
}

function emptySequenceStats(): SequenceStats {
  return {
    totalEnrolled: 0,
    active: 0,
    completed: 0,
    replied: 0,
    bounced: 0,
    unsubscribed: 0,
    openRate: 0,
    clickRate: 0,
    replyRate: 0,
    avgResponseTime: 0,
  };
}

function computeRate(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 100; // two-decimal percentage
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/** Map condition type labels (past tense) to response type labels (present tense) */
const CONDITION_TO_RESPONSE: Record<EmailStep['conditionType'], ContactResponse['type'] | null> = {
  opened: 'open',
  clicked: 'click',
  replied: 'reply',
  none: null,
};

// ---------------------------------------------------------------------------
// Built-in template sequences
// ---------------------------------------------------------------------------

function buildWarmIntroSequence(): EmailSequence {
  const now = nowISO();
  return {
    id: 'builtin-warm-intro',
    name: 'The Warm Intro',
    description: 'A 4-step warm introduction sequence over 14 days. Best for prospects where you have a mutual connection or prior context.',
    steps: [
      {
        id: 'warm-step-1',
        order: 0,
        subject: 'Quick question — {{mutual_connection}} suggested I reach out',
        body: 'Hi {{first_name}},\n\n{{mutual_connection}} mentioned you might be the right person to talk to about {{pain_point}}.\n\nI noticed {{company}} recently {{recent_signal}} — we have helped similar companies {{value_prop}}.\n\nWould you be open to a brief conversation?\n\nBest,\n{{sender_name}}',
        delayDays: 0,
        template: 'warm_followup',
        isConditional: false,
        conditionType: 'none',
        stepStats: emptyStepStats(),
      },
      {
        id: 'warm-step-2',
        order: 1,
        subject: 'Re: Quick question — following up',
        body: 'Hi {{first_name}},\n\nJust circling back on my note below. I understand things get busy.\n\nI put together a brief overview of how we have helped companies like {{company}} — would it be useful if I shared it?\n\nBest,\n{{sender_name}}',
        delayDays: 3,
        template: 'warm_followup',
        isConditional: false,
        conditionType: 'none',
        stepStats: emptyStepStats(),
      },
      {
        id: 'warm-step-3',
        order: 2,
        subject: 'Re: Quick question — one more thought',
        body: 'Hi {{first_name}},\n\nI wanted to share a quick case study from {{similar_company}} — they saw {{result}} after implementing our approach.\n\nGiven {{company}}\'s {{recent_signal}}, I think the timing could be right.\n\nHappy to walk through it in 15 minutes if helpful.\n\nBest,\n{{sender_name}}',
        delayDays: 4,
        template: 'warm_followup',
        isConditional: true,
        conditionType: 'opened',
        fallbackStepId: 'warm-step-4',
        stepStats: emptyStepStats(),
      },
      {
        id: 'warm-step-4',
        order: 3,
        subject: 'Closing the loop',
        body: 'Hi {{first_name}},\n\nI do not want to be a pest — just wanted to close the loop.\n\nIf the timing is not right, completely understand. If things change down the road, feel free to reach out anytime.\n\nWishing you and the {{company}} team continued success.\n\nBest,\n{{sender_name}}',
        delayDays: 7,
        template: 'warm_followup',
        isConditional: false,
        conditionType: 'none',
        stepStats: emptyStepStats(),
      },
    ],
    targetContacts: [],
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    stats: emptySequenceStats(),
    tags: ['warm-intro', 'referral', 'built-in'],
  };
}

function buildSignalTriggerSequence(): EmailSequence {
  const now = nowISO();
  return {
    id: 'builtin-signal-trigger',
    name: 'Signal Trigger',
    description: 'A 3-step trigger-based sequence over 10 days. Designed for prospects who triggered a buying signal (funding, hiring surge, leadership change).',
    steps: [
      {
        id: 'signal-step-1',
        order: 0,
        subject: 'Congrats on {{trigger_event}} — quick thought',
        body: 'Hi {{first_name}},\n\nI saw that {{company}} {{trigger_detail}}. Congrats — that is a big milestone.\n\nWhen companies hit this stage, they often start evaluating {{pain_point}} solutions. We have helped teams like yours {{value_prop}}.\n\nWorth a 10-minute chat to see if there is a fit?\n\nBest,\n{{sender_name}}',
        delayDays: 0,
        template: 'trigger_based',
        isConditional: false,
        conditionType: 'none',
        stepStats: emptyStepStats(),
      },
      {
        id: 'signal-step-2',
        order: 1,
        subject: 'Re: {{trigger_event}} — a relevant case study',
        body: 'Hi {{first_name}},\n\nFollowing up with something concrete — {{similar_company}} was in a similar position after their {{similar_trigger}}.\n\nHere is what they did:\n- {{result_1}}\n- {{result_2}}\n- {{result_3}}\n\nI can share the full breakdown if interesting.\n\nBest,\n{{sender_name}}',
        delayDays: 4,
        template: 'trigger_based',
        isConditional: true,
        conditionType: 'opened',
        fallbackStepId: 'signal-step-3',
        abVariant: 'A',
        stepStats: emptyStepStats(),
      },
      {
        id: 'signal-step-3',
        order: 2,
        subject: 'Last note — keeping it brief',
        body: 'Hi {{first_name}},\n\nI will keep this short: if {{trigger_event}} means your team is evaluating new approaches, I would love to be a resource.\n\nNo pressure — just reply "interested" and I will send over relevant details.\n\nBest,\n{{sender_name}}',
        delayDays: 6,
        template: 'trigger_based',
        isConditional: false,
        conditionType: 'none',
        stepStats: emptyStepStats(),
      },
    ],
    targetContacts: [],
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    stats: emptySequenceStats(),
    tags: ['trigger', 'signal-based', 'built-in'],
  };
}

function buildReEngagementSequence(): EmailSequence {
  const now = nowISO();
  return {
    id: 'builtin-re-engagement',
    name: 'Re-engagement',
    description: 'A 3-step re-engagement sequence over 21 days. For prospects who went cold or did not respond to previous outreach.',
    steps: [
      {
        id: 'reengage-step-1',
        order: 0,
        subject: 'Things have changed since we last spoke',
        body: 'Hi {{first_name}},\n\nIt has been a while since we connected. A lot has changed — both at {{company}} and on our end.\n\nI noticed {{recent_signal}} and thought it might be worth revisiting our conversation about {{pain_point}}.\n\nWe have since {{new_capability}}, which directly addresses the concern you raised last time.\n\nOpen to a fresh conversation?\n\nBest,\n{{sender_name}}',
        delayDays: 0,
        template: 'warm_followup',
        isConditional: false,
        conditionType: 'none',
        stepStats: emptyStepStats(),
      },
      {
        id: 'reengage-step-2',
        order: 1,
        subject: 'Re: A quick update for you',
        body: 'Hi {{first_name}},\n\nI wanted to share a quick win from {{similar_company}}: {{result}}.\n\nThey were in a similar spot to {{company}} when we first connected with them. Thought it might resonate.\n\nWould a 15-minute call make sense?\n\nBest,\n{{sender_name}}',
        delayDays: 10,
        template: 'warm_followup',
        isConditional: true,
        conditionType: 'opened',
        fallbackStepId: 'reengage-step-3',
        stepStats: emptyStepStats(),
      },
      {
        id: 'reengage-step-3',
        order: 2,
        subject: 'Should I close your file?',
        body: 'Hi {{first_name}},\n\nI do not want to keep reaching out if the timing is off. Completely understand if priorities have shifted.\n\nIf you would like me to check back in a few months, just say the word. Otherwise, I will assume now is not the right time and close the loop.\n\nEither way — wishing {{company}} the best.\n\nBest,\n{{sender_name}}',
        delayDays: 11,
        template: 'warm_followup',
        isConditional: false,
        conditionType: 'none',
        stepStats: emptyStepStats(),
      },
    ],
    targetContacts: [],
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    stats: emptySequenceStats(),
    tags: ['re-engagement', 'winback', 'built-in'],
  };
}

// ---------------------------------------------------------------------------
// Email Sequence Manager (Singleton)
// ---------------------------------------------------------------------------

export class EmailSequenceManager {
  private sequences: Map<string, EmailSequence> = new Map();
  private initialized = false;

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  private async load(): Promise<void> {
    if (this.initialized) return;
    try {
      const envelope = await getPersistentCache<EmailSequence[]>(CACHE_KEY);
      if (envelope?.data) {
        for (const seq of envelope.data) {
          this.sequences.set(seq.id, seq);
        }
      }
    } catch (err) {
      console.warn('[email-sequences] Failed to load from cache', err);
    }
    this.initialized = true;
  }

  private async persist(): Promise<void> {
    try {
      const data = Array.from(this.sequences.values());
      await setPersistentCache(CACHE_KEY, data);
    } catch (err) {
      console.warn('[email-sequences] Failed to persist to cache', err);
    }
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.initialized) {
      await this.load();
    }
  }

  // -------------------------------------------------------------------------
  // Sequence CRUD
  // -------------------------------------------------------------------------

  async createSequence(data: CreateSequenceData): Promise<EmailSequence> {
    await this.ensureLoaded();

    const now = nowISO();
    const id = generateId();

    const steps: EmailStep[] = (data.steps ?? []).map((s, idx) => ({
      ...s,
      id: generateId(),
      order: idx,
      stepStats: emptyStepStats(),
    }));

    const sequence: EmailSequence = {
      id,
      name: data.name,
      description: data.description,
      steps,
      targetContacts: [],
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      stats: emptySequenceStats(),
      tags: data.tags,
    };

    this.sequences.set(id, sequence);
    await this.persist();
    return sequence;
  }

  async updateSequence(id: string, changes: UpdateSequenceData): Promise<EmailSequence> {
    await this.ensureLoaded();

    const seq = this.sequences.get(id);
    if (!seq) throw new Error(`Sequence not found: ${id}`);

    if (changes.name !== undefined) seq.name = changes.name;
    if (changes.description !== undefined) seq.description = changes.description;
    if (changes.tags !== undefined) seq.tags = changes.tags;
    if (changes.status !== undefined) seq.status = changes.status;
    seq.updatedAt = nowISO();

    await this.persist();
    return seq;
  }

  async deleteSequence(id: string): Promise<void> {
    await this.ensureLoaded();

    if (!this.sequences.has(id)) throw new Error(`Sequence not found: ${id}`);
    this.sequences.delete(id);
    await this.persist();
  }

  async getSequence(id: string): Promise<EmailSequence | null> {
    await this.ensureLoaded();
    return this.sequences.get(id) ?? null;
  }

  async listSequences(): Promise<EmailSequence[]> {
    await this.ensureLoaded();
    return Array.from(this.sequences.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }

  // -------------------------------------------------------------------------
  // Step management
  // -------------------------------------------------------------------------

  async addStep(sequenceId: string, step: AddStepData): Promise<EmailStep> {
    await this.ensureLoaded();

    const seq = this.sequences.get(sequenceId);
    if (!seq) throw new Error(`Sequence not found: ${sequenceId}`);

    const newStep: EmailStep = {
      ...step,
      id: generateId(),
      stepStats: emptyStepStats(),
    };

    seq.steps.push(newStep);
    // Re-normalize order
    seq.steps.sort((a, b) => a.order - b.order);
    seq.steps.forEach((s, idx) => { s.order = idx; });

    seq.updatedAt = nowISO();
    await this.persist();
    return newStep;
  }

  async removeStep(sequenceId: string, stepId: string): Promise<void> {
    await this.ensureLoaded();

    const seq = this.sequences.get(sequenceId);
    if (!seq) throw new Error(`Sequence not found: ${sequenceId}`);

    const idx = seq.steps.findIndex(s => s.id === stepId);
    if (idx === -1) throw new Error(`Step not found: ${stepId}`);

    seq.steps.splice(idx, 1);
    // Re-normalize order
    seq.steps.forEach((s, i) => { s.order = i; });

    // Clean up any fallback references pointing to the deleted step
    for (const s of seq.steps) {
      if (s.fallbackStepId === stepId) {
        s.fallbackStepId = undefined;
      }
    }

    seq.updatedAt = nowISO();
    await this.persist();
  }

  async reorderSteps(sequenceId: string, stepIds: string[]): Promise<void> {
    await this.ensureLoaded();

    const seq = this.sequences.get(sequenceId);
    if (!seq) throw new Error(`Sequence not found: ${sequenceId}`);

    const stepMap = new Map(seq.steps.map(s => [s.id, s]));

    // Validate that all provided IDs exist in the sequence
    for (const id of stepIds) {
      if (!stepMap.has(id)) throw new Error(`Step not found in sequence: ${id}`);
    }

    // Rebuild the steps array in the new order
    const reordered: EmailStep[] = [];
    for (let i = 0; i < stepIds.length; i++) {
      const step = stepMap.get(stepIds[i]!)!;
      step.order = i;
      reordered.push(step);
    }

    // Append any steps not listed in stepIds at the end (defensive)
    for (const step of seq.steps) {
      if (!stepIds.includes(step.id)) {
        step.order = reordered.length;
        reordered.push(step);
      }
    }

    seq.steps = reordered;
    seq.updatedAt = nowISO();
    await this.persist();
  }

  // -------------------------------------------------------------------------
  // Contact enrollment
  // -------------------------------------------------------------------------

  async enrollContact(sequenceId: string, contact: EnrollContactData): Promise<SequenceContact> {
    await this.ensureLoaded();

    const seq = this.sequences.get(sequenceId);
    if (!seq) throw new Error(`Sequence not found: ${sequenceId}`);

    // Prevent duplicate enrollment
    const existing = seq.targetContacts.find(c => c.email === contact.email);
    if (existing) throw new Error(`Contact ${contact.email} is already enrolled in sequence ${sequenceId}`);

    const now = nowISO();
    const firstStep = seq.steps.length > 0 ? seq.steps[0]! : null;

    const seqContact: SequenceContact = {
      email: contact.email,
      name: contact.name,
      company: contact.company,
      currentStep: 0,
      status: seq.status === 'active' ? 'active' : 'paused',
      enrolledAt: now,
      lastStepSentAt: null,
      nextStepDue: firstStep
        ? addDays(now, firstStep.delayDays)
        : null,
      responses: [],
    };

    seq.targetContacts.push(seqContact);
    this.recalculateStats(seq);
    seq.updatedAt = nowISO();
    await this.persist();
    return seqContact;
  }

  async unenrollContact(sequenceId: string, email: string): Promise<void> {
    await this.ensureLoaded();

    const seq = this.sequences.get(sequenceId);
    if (!seq) throw new Error(`Sequence not found: ${sequenceId}`);

    const idx = seq.targetContacts.findIndex(c => c.email === email);
    if (idx === -1) throw new Error(`Contact ${email} not found in sequence ${sequenceId}`);

    seq.targetContacts.splice(idx, 1);
    this.recalculateStats(seq);
    seq.updatedAt = nowISO();
    await this.persist();
  }

  // -------------------------------------------------------------------------
  // Contact progression
  // -------------------------------------------------------------------------

  async advanceContact(sequenceId: string, email: string): Promise<SequenceContact> {
    await this.ensureLoaded();

    const seq = this.sequences.get(sequenceId);
    if (!seq) throw new Error(`Sequence not found: ${sequenceId}`);

    const contact = seq.targetContacts.find(c => c.email === email);
    if (!contact) throw new Error(`Contact ${email} not found in sequence ${sequenceId}`);
    if (contact.status !== 'active') throw new Error(`Contact ${email} is not active (status: ${contact.status})`);

    const currentStepObj = seq.steps.find(s => s.order === contact.currentStep);
    if (currentStepObj) {
      currentStepObj.stepStats.sent += 1;
    }

    const now = nowISO();
    contact.lastStepSentAt = now;

    const nextOrder = contact.currentStep + 1;
    const nextStep = seq.steps.find(s => s.order === nextOrder);

    if (nextStep) {
      // Check conditional logic
      if (nextStep.isConditional && nextStep.conditionType !== 'none') {
        const requiredResponseType = CONDITION_TO_RESPONSE[nextStep.conditionType];
        const hasMatchingResponse = requiredResponseType !== null && contact.responses.some(
          r => currentStepObj && r.stepId === currentStepObj.id && r.type === requiredResponseType,
        );

        if (!hasMatchingResponse && nextStep.fallbackStepId) {
          // Jump to fallback step instead
          const fallback = seq.steps.find(s => s.id === nextStep.fallbackStepId);
          if (fallback) {
            contact.currentStep = fallback.order;
            contact.nextStepDue = addDays(now, fallback.delayDays);
            this.recalculateStats(seq);
            seq.updatedAt = nowISO();
            await this.persist();
            return contact;
          }
        }
      }

      contact.currentStep = nextOrder;
      contact.nextStepDue = addDays(now, nextStep.delayDays);
    } else {
      // No more steps — mark completed
      contact.status = 'completed';
      contact.nextStepDue = null;
    }

    this.recalculateStats(seq);
    seq.updatedAt = nowISO();
    await this.persist();
    return contact;
  }

  async recordResponse(
    sequenceId: string,
    email: string,
    type: 'open' | 'click' | 'reply' | 'bounce',
  ): Promise<void> {
    await this.ensureLoaded();

    const seq = this.sequences.get(sequenceId);
    if (!seq) throw new Error(`Sequence not found: ${sequenceId}`);

    const contact = seq.targetContacts.find(c => c.email === email);
    if (!contact) throw new Error(`Contact ${email} not found in sequence ${sequenceId}`);

    const currentStepObj = seq.steps.find(s => s.order === contact.currentStep);
    const stepId = currentStepObj?.id ?? 'unknown';

    const response: ContactResponse = {
      type,
      stepId,
      timestamp: nowISO(),
    };

    contact.responses.push(response);

    // Update step-level stats
    if (currentStepObj) {
      switch (type) {
        case 'open':
          currentStepObj.stepStats.opened += 1;
          break;
        case 'click':
          currentStepObj.stepStats.clicked += 1;
          break;
        case 'reply':
          currentStepObj.stepStats.replied += 1;
          break;
        case 'bounce':
          currentStepObj.stepStats.bounced += 1;
          break;
      }
    }

    // Update contact status for terminal events
    switch (type) {
      case 'reply':
        contact.status = 'replied';
        contact.nextStepDue = null;
        break;
      case 'bounce':
        contact.status = 'bounced';
        contact.nextStepDue = null;
        break;
    }

    this.recalculateStats(seq);
    seq.updatedAt = nowISO();
    await this.persist();
  }

  // -------------------------------------------------------------------------
  // Send queue
  // -------------------------------------------------------------------------

  async getNextActions(): Promise<ScheduledAction[]> {
    await this.ensureLoaded();

    const now = new Date();
    const actions: ScheduledAction[] = [];

    for (const seq of this.sequences.values()) {
      if (seq.status !== 'active') continue;

      for (const contact of seq.targetContacts) {
        if (contact.status !== 'active') continue;
        if (!contact.nextStepDue) continue;

        const dueDate = new Date(contact.nextStepDue);
        if (dueDate <= now) {
          const step = seq.steps.find(s => s.order === contact.currentStep);
          if (step) {
            actions.push({
              sequenceId: seq.id,
              sequenceName: seq.name,
              contact,
              step,
            });
          }
        }
      }
    }

    // Sort by due date (earliest first)
    actions.sort((a, b) => {
      const aDue = a.contact.nextStepDue ?? '';
      const bDue = b.contact.nextStepDue ?? '';
      return aDue.localeCompare(bDue);
    });

    return actions;
  }

  // -------------------------------------------------------------------------
  // Sequence state control
  // -------------------------------------------------------------------------

  async activateSequence(id: string): Promise<EmailSequence> {
    await this.ensureLoaded();

    const seq = this.sequences.get(id);
    if (!seq) throw new Error(`Sequence not found: ${id}`);

    if (seq.steps.length === 0) {
      throw new Error('Cannot activate a sequence with no steps');
    }

    seq.status = 'active';

    // Activate all paused contacts and set their next step due if missing
    const now = nowISO();
    for (const contact of seq.targetContacts) {
      if (contact.status === 'paused') {
        contact.status = 'active';
        if (!contact.nextStepDue) {
          const step = seq.steps.find(s => s.order === contact.currentStep);
          if (step) {
            contact.nextStepDue = addDays(now, step.delayDays);
          }
        }
      }
    }

    seq.updatedAt = nowISO();
    await this.persist();
    return seq;
  }

  async pauseSequence(id: string): Promise<EmailSequence> {
    await this.ensureLoaded();

    const seq = this.sequences.get(id);
    if (!seq) throw new Error(`Sequence not found: ${id}`);

    seq.status = 'paused';

    // Pause all active contacts
    for (const contact of seq.targetContacts) {
      if (contact.status === 'active') {
        contact.status = 'paused';
      }
    }

    seq.updatedAt = nowISO();
    await this.persist();
    return seq;
  }

  // -------------------------------------------------------------------------
  // Analytics
  // -------------------------------------------------------------------------

  async getSequenceAnalytics(id: string): Promise<SequenceAnalytics> {
    await this.ensureLoaded();

    const seq = this.sequences.get(id);
    if (!seq) throw new Error(`Sequence not found: ${id}`);

    // Per-step analytics
    const perStep: StepAnalytics[] = seq.steps.map(step => ({
      stepId: step.id,
      order: step.order,
      subject: step.subject,
      stats: { ...step.stepStats },
      openRate: computeRate(step.stepStats.opened, step.stepStats.sent),
      clickRate: computeRate(step.stepStats.clicked, step.stepStats.sent),
      replyRate: computeRate(step.stepStats.replied, step.stepStats.sent),
      bounceRate: computeRate(step.stepStats.bounced, step.stepStats.sent),
    }));

    // A/B comparisons — group steps by order and compare variants
    const abComparisons: ABComparison[] = [];
    const stepsByOrder = new Map<number, StepAnalytics[]>();

    for (const sa of perStep) {
      const step = seq.steps.find(s => s.id === sa.stepId);
      if (step?.abVariant) {
        const group = stepsByOrder.get(sa.order) ?? [];
        group.push(sa);
        stepsByOrder.set(sa.order, group);
      }
    }

    for (const [order, variants] of stepsByOrder) {
      const variantA = variants.find(v => {
        const step = seq.steps.find(s => s.id === v.stepId);
        return step?.abVariant === 'A';
      }) ?? null;

      const variantB = variants.find(v => {
        const step = seq.steps.find(s => s.id === v.stepId);
        return step?.abVariant === 'B';
      }) ?? null;

      let winner: 'A' | 'B' | 'inconclusive' = 'inconclusive';
      if (variantA && variantB) {
        const scoreA = variantA.openRate + variantA.replyRate * 2;
        const scoreB = variantB.openRate + variantB.replyRate * 2;
        const minSample = 10;
        if (variantA.stats.sent >= minSample && variantB.stats.sent >= minSample) {
          if (scoreA > scoreB * 1.1) winner = 'A';
          else if (scoreB > scoreA * 1.1) winner = 'B';
        }
      }

      abComparisons.push({ stepOrder: order, variantA, variantB, winner });
    }

    // Average steps completed
    const contactSteps = seq.targetContacts.map(c => c.currentStep);
    const avgStepsCompleted = contactSteps.length > 0
      ? Math.round((contactSteps.reduce((sum, v) => sum + v, 0) / contactSteps.length) * 100) / 100
      : 0;

    // Completion rate
    const completedCount = seq.targetContacts.filter(c => c.status === 'completed').length;
    const completionRate = computeRate(completedCount, seq.targetContacts.length);

    return {
      sequenceId: seq.id,
      sequenceName: seq.name,
      overallStats: { ...seq.stats },
      perStep,
      abComparisons,
      avgStepsCompleted,
      completionRate,
    };
  }

  // -------------------------------------------------------------------------
  // Clone
  // -------------------------------------------------------------------------

  async cloneSequence(id: string): Promise<EmailSequence> {
    await this.ensureLoaded();

    const original = this.sequences.get(id);
    if (!original) throw new Error(`Sequence not found: ${id}`);

    const now = nowISO();
    const newId = generateId();

    // Deep-clone steps with fresh IDs and zeroed stats
    const idMapping = new Map<string, string>();
    const clonedSteps: EmailStep[] = original.steps.map(step => {
      const newStepId = generateId();
      idMapping.set(step.id, newStepId);
      return {
        ...step,
        id: newStepId,
        stepStats: emptyStepStats(),
      };
    });

    // Remap fallback step IDs
    for (const step of clonedSteps) {
      if (step.fallbackStepId) {
        step.fallbackStepId = idMapping.get(step.fallbackStepId) ?? step.fallbackStepId;
      }
    }

    const cloned: EmailSequence = {
      id: newId,
      name: `${original.name} (Copy)`,
      description: original.description,
      steps: clonedSteps,
      targetContacts: [],
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      stats: emptySequenceStats(),
      tags: [...original.tags],
    };

    this.sequences.set(newId, cloned);
    await this.persist();
    return cloned;
  }

  // -------------------------------------------------------------------------
  // Built-in templates
  // -------------------------------------------------------------------------

  async loadBuiltInTemplates(): Promise<EmailSequence[]> {
    await this.ensureLoaded();

    const templates = [
      buildWarmIntroSequence(),
      buildSignalTriggerSequence(),
      buildReEngagementSequence(),
    ];

    const loaded: EmailSequence[] = [];
    for (const tpl of templates) {
      if (!this.sequences.has(tpl.id)) {
        this.sequences.set(tpl.id, tpl);
        loaded.push(tpl);
      } else {
        loaded.push(this.sequences.get(tpl.id)!);
      }
    }

    if (loaded.length > 0) {
      await this.persist();
    }

    return loaded;
  }

  // -------------------------------------------------------------------------
  // Stats recalculation
  // -------------------------------------------------------------------------

  private recalculateStats(seq: EmailSequence): void {
    const contacts = seq.targetContacts;
    const total = contacts.length;

    const active = contacts.filter(c => c.status === 'active').length;
    const completed = contacts.filter(c => c.status === 'completed').length;
    const replied = contacts.filter(c => c.status === 'replied').length;
    const bounced = contacts.filter(c => c.status === 'bounced').length;
    const unsubscribed = contacts.filter(c => c.status === 'unsubscribed').length;

    // Aggregate step stats for rate calculations
    let totalSent = 0;
    let totalOpened = 0;
    let totalClicked = 0;
    let totalReplied = 0;

    for (const step of seq.steps) {
      totalSent += step.stepStats.sent;
      totalOpened += step.stepStats.opened;
      totalClicked += step.stepStats.clicked;
      totalReplied += step.stepStats.replied;
    }

    // Calculate average response time from reply responses
    let totalResponseMs = 0;
    let replyCount = 0;

    for (const contact of contacts) {
      const replies = contact.responses.filter(r => r.type === 'reply');
      for (const reply of replies) {
        // Measure time from enrollment to reply
        const enrolledMs = new Date(contact.enrolledAt).getTime();
        const replyMs = new Date(reply.timestamp).getTime();
        if (replyMs > enrolledMs) {
          totalResponseMs += replyMs - enrolledMs;
          replyCount += 1;
        }
      }
    }

    const avgResponseTimeHours = replyCount > 0
      ? Math.round((totalResponseMs / replyCount / (1000 * 60 * 60)) * 100) / 100
      : 0;

    seq.stats = {
      totalEnrolled: total,
      active,
      completed,
      replied,
      bounced,
      unsubscribed,
      openRate: computeRate(totalOpened, totalSent),
      clickRate: computeRate(totalClicked, totalSent),
      replyRate: computeRate(totalReplied, totalSent),
      avgResponseTime: avgResponseTimeHours,
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const emailSequenceManager = new EmailSequenceManager();
