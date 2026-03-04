import { extractJson, validateDimensionScores, type DimensionScore } from '../../../../src/utils/ai-response';
import { trackUsage } from '../../claude/v1/spend-tracker';
import { buildSystemMessages, buildUserContent, ASSESSMENT_DISCLAIMER } from './jp360-prompts';

const SONNET_MODEL = 'claude-sonnet-4-20250514';
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

export interface AssessmentInput {
  query: string;
  region: string;
  timeframe: string;
  evidence: string[];
}

export interface AssessmentOutput {
  dimensions: DimensionScore[];
  overallProbability: number;
  confidenceLevel: string;
  analysisText: string;
  disclaimer: string;
  cachedAt: number;
  modelUsed: string;
  status: string;
  errorMessage: string;
}

const ERROR_RESULT: AssessmentOutput = {
  dimensions: [],
  overallProbability: 0,
  confidenceLevel: 'low',
  analysisText: '',
  disclaimer: ASSESSMENT_DISCLAIMER,
  cachedAt: 0,
  modelUsed: '',
  status: 'error',
  errorMessage: '',
};

/**
 * Compute weighted probability from validated dimension scores.
 */
function computeWeightedProbability(dimensions: DimensionScore[]): number {
  if (dimensions.length === 0) return 0;
  const weightSum = dimensions.reduce((s, d) => s + d.weight, 0);
  if (weightSum === 0) return 0;
  const weighted = dimensions.reduce((s, d) => s + d.score * d.weight, 0) / weightSum;
  return Math.max(0, Math.min(1, weighted));
}

/**
 * Determine confidence level based on variance of dimension scores.
 * Low variance (scores cluster) = high confidence in the estimate.
 * High variance (scores diverge) = low confidence.
 */
function computeConfidence(dimensions: DimensionScore[]): string {
  if (dimensions.length < 2) return 'low';
  const mean = dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length;
  const variance = dimensions.reduce((s, d) => s + (d.score - mean) ** 2, 0) / dimensions.length;
  // Thresholds: variance < 0.02 = high, < 0.06 = medium, else low
  if (variance < 0.02) return 'high';
  if (variance < 0.06) return 'medium';
  return 'low';
}

export async function handleAssessment(input: AssessmentInput): Promise<AssessmentOutput> {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) return { ...ERROR_RESULT, errorMessage: 'Claude API key not configured' };

  const userContent = buildUserContent(input.query, input.region, input.timeframe, input.evidence);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: SONNET_MODEL,
        max_tokens: 4096,
        system: buildSystemMessages(),
        messages: [{ role: 'user', content: userContent }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return { ...ERROR_RESULT, errorMessage: `Claude API error: ${response.status}` };
    }

    const data = await response.json() as any;
    const text = data.content?.[0]?.text ?? '';
    const parsed = extractJson<{
      dimensions: DimensionScore[];
      confidence: string;
      analysis_text: string;
    }>(text);

    const validatedDimensions = validateDimensionScores(parsed.dimensions ?? []);
    const overallProbability = computeWeightedProbability(validatedDimensions);
    const confidenceLevel = parsed.confidence || computeConfidence(validatedDimensions);

    const inputTokens = data.usage?.input_tokens ?? 0;
    const outputTokens = data.usage?.output_tokens ?? 0;
    trackUsage(inputTokens, outputTokens, 'sonnet');

    return {
      dimensions: validatedDimensions,
      overallProbability,
      confidenceLevel,
      analysisText: parsed.analysis_text ?? '',
      disclaimer: ASSESSMENT_DISCLAIMER,
      cachedAt: Date.now(),
      modelUsed: SONNET_MODEL,
      status: 'ok',
      errorMessage: '',
    };
  } catch (err) {
    return { ...ERROR_RESULT, errorMessage: err instanceof Error ? err.message : 'Unknown error' };
  }
}
