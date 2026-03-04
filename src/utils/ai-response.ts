export function extractJson<T>(text: string): T {
  // Try direct parse first
  try {
    return JSON.parse(text) as T;
  } catch { /* continue to extraction */ }

  // Try extracting from markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim()) as T;
    } catch { /* continue */ }
  }

  // Try finding JSON object/array in text
  const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]) as T;
    } catch { /* fall through */ }
  }

  throw new Error('Failed to extract JSON from AI response');
}

export interface DimensionScore {
  name: string;
  score: number;
  weight: number;
  reasoning: string;
}

export function validateDimensionScores(dimensions: DimensionScore[]): DimensionScore[] {
  const clamped = dimensions.map(d => ({
    ...d,
    score: Math.max(0, Math.min(1, Number(d.score) || 0)),
    weight: Math.max(0, Number(d.weight) || 0),
  }));

  const weightSum = clamped.reduce((s, d) => s + d.weight, 0);
  if (weightSum > 0 && Math.abs(weightSum - 1.0) > 0.01) {
    return clamped.map(d => ({ ...d, weight: d.weight / weightSum }));
  }

  return clamped;
}
