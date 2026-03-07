import { StabilityLevel } from "@bantay-pilipinas/shared";
import type { WPSTensionScore } from "@bantay-pilipinas/shared";

function getLevel(score: number): StabilityLevel {
  if (score < 20) return StabilityLevel.Low;
  if (score < 35) return StabilityLevel.Guarded;
  if (score < 50) return StabilityLevel.Elevated;
  if (score < 70) return StabilityLevel.High;
  return StabilityLevel.Severe;
}

export function computeWPSTension(
  vesselIntrusions: number,
  diplomaticSignals: number,
  militaryActivity: number,
  newsVelocity: number
): WPSTensionScore {
  const score =
    vesselIntrusions * 0.35 +
    diplomaticSignals * 0.25 +
    militaryActivity * 0.25 +
    newsVelocity * 0.15;

  return {
    score,
    components: { vesselIntrusions, diplomaticSignals, militaryActivity, newsVelocity },
    level: getLevel(score),
    trend: "stable",
    computedAt: new Date().toISOString(),
  };
}
