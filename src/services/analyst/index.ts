import { AnalystServiceClient } from '../../generated/client/worldmonitor/analyst/v1/service_client';
import { createCircuitBreaker } from '@/utils';
import type { AssessmentResponse } from '../../generated/client/worldmonitor/analyst/v1/service_client';

const client = new AnalystServiceClient('', { fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args) });

const assessmentBreaker = createCircuitBreaker<AssessmentResponse>({
  name: 'Analyst Assessment',
  cacheTtlMs: 30 * 60 * 1000, // 30min cache TTL
  persistCache: true,
});

const emptyAssessment: AssessmentResponse = {
  dimensions: [],
  overallProbability: 0,
  confidenceLevel: 'low',
  analysisText: '',
  disclaimer: '',
  cachedAt: 0,
  modelUsed: '',
  status: 'error',
  errorMessage: 'Circuit breaker open',
};

export async function runAssessment(
  query: string,
  region: string,
  timeframe: string,
  evidence: string[] = [],
): Promise<AssessmentResponse> {
  return assessmentBreaker.execute(
    () => client.runAssessment({ query, region, timeframe, evidence }),
    emptyAssessment,
  );
}
