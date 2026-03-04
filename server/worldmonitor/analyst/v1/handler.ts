import type { AnalystServiceHandler, ServerContext, AssessmentRequest } from '../../../../src/generated/server/worldmonitor/analyst/v1/service_server';
import { handleAssessment } from './assessment';

export const analystHandler: AnalystServiceHandler = {
  runAssessment: (_ctx: ServerContext, req: AssessmentRequest) => handleAssessment(req),
};
