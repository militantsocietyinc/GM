/**
 * JP 3-60 Joint Intelligence Preparation of the Operational Environment (JIPOE)
 * Six-step military analysis framework adapted for conflict probability assessment.
 *
 * Reference: Joint Publication 3-60, Joint Targeting (2013, revised 2017)
 *
 * The six dimensions with default weights:
 *  1. Military Readiness  (20%) - Force deployments, logistics, readiness posture
 *  2. Political Will      (25%) - Leadership statements, domestic politics, authorization
 *  3. Target Urgency      (20%) - Threat timelines, capability windows, opportunity cost
 *  4. Diplomatic Alternatives (15%) - Negotiation status, sanctions, mediation
 *  5. Regional Alliance Support (10%) - Coalition readiness, basing agreements, intel sharing
 *  6. Provocation Level   (10%) - Recent incidents, escalation patterns, redline breaches
 */

export const DEFAULT_DIMENSION_WEIGHTS: Record<string, number> = {
  'Military Readiness': 0.20,
  'Political Will': 0.25,
  'Target Urgency': 0.20,
  'Diplomatic Alternatives': 0.15,
  'Regional Alliance Support': 0.10,
  'Provocation Level': 0.10,
};

export const JP360_SYSTEM_PROMPT = `You are a senior military intelligence analyst applying the JP 3-60 Joint Targeting framework to assess conflict probability.

## Framework

Score the query on exactly 6 dimensions (each 0.0 to 1.0):

1. **Military Readiness** (weight 0.20)
   - Force deployments, logistics posture, pre-positioning, readiness exercises
   - Higher score = forces are mobilized and prepared for action

2. **Political Will** (weight 0.25)
   - Leadership rhetoric, domestic political dynamics, legislative authorization
   - Higher score = political leadership is committed and capable of authorizing action

3. **Target Urgency** (weight 0.20)
   - Threat timelines, fleeting capability windows, first-mover advantage
   - Higher score = time-sensitive factors create pressure for immediate action

4. **Diplomatic Alternatives** (weight 0.15)
   - Negotiation status, sanctions effectiveness, third-party mediation
   - Higher score = diplomatic channels are exhausted or failing (increases conflict probability)

5. **Regional Alliance Support** (weight 0.10)
   - Coalition readiness, basing agreements, intelligence sharing, overflight rights
   - Higher score = regional allies are aligned and supportive

6. **Provocation Level** (weight 0.10)
   - Recent incidents, escalation patterns, redline breaches, retaliatory dynamics
   - Higher score = recent provocations have increased escalation pressure

## Response Format

You MUST respond with a single JSON object (no markdown, no explanation outside JSON):

{
  "dimensions": [
    {"name": "Military Readiness", "score": 0.0, "weight": 0.20, "reasoning": "Brief explanation"},
    {"name": "Political Will", "score": 0.0, "weight": 0.25, "reasoning": "Brief explanation"},
    {"name": "Target Urgency", "score": 0.0, "weight": 0.20, "reasoning": "Brief explanation"},
    {"name": "Diplomatic Alternatives", "score": 0.0, "weight": 0.15, "reasoning": "Brief explanation"},
    {"name": "Regional Alliance Support", "score": 0.0, "weight": 0.10, "reasoning": "Brief explanation"},
    {"name": "Provocation Level", "score": 0.0, "weight": 0.10, "reasoning": "Brief explanation"}
  ],
  "confidence": "low|medium|high",
  "analysis_text": "2-3 paragraph assessment synthesizing the dimension scores into an overall narrative"
}

## Rules
- All scores must be between 0.0 and 1.0
- Weights must sum to 1.0
- Confidence reflects how much high-quality evidence is available
- Be specific about which real-world factors drive each score
- Do not speculate beyond available evidence
- Acknowledge uncertainty explicitly when evidence is ambiguous`;

/**
 * Build the system message array with cache_control hints for prompt caching.
 * The static JP 3-60 instructions are marked as cacheable since they never change.
 */
export function buildSystemMessages(): Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }> {
  return [
    {
      type: 'text',
      text: JP360_SYSTEM_PROMPT,
      cache_control: { type: 'ephemeral' },
    },
  ];
}

/**
 * Build the user message content from assessment request parameters.
 */
export function buildUserContent(query: string, region: string, timeframe: string, evidence: string[]): string {
  const parts = [`Query: ${query}`];
  if (region) parts.push(`Region: ${region}`);
  if (timeframe) parts.push(`Timeframe: ${timeframe}`);
  if (evidence.length > 0) {
    parts.push(`\nAdditional Evidence:\n${evidence.map((e, i) => `${i + 1}. ${e}`).join('\n')}`);
  }
  return parts.join('\n');
}

/** Ethical disclaimer appended to every assessment. */
export const ASSESSMENT_DISCLAIMER =
  'This is an AI-generated analytical estimate using the JP 3-60 framework. ' +
  'It is not a definitive prediction and should not be used as the sole basis for any decision. ' +
  'All scores reflect probabilistic reasoning under uncertainty, not certainty of outcomes.';
