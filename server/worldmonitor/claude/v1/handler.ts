import type { ClaudeServiceHandler, ServerContext, SummarizeRequest, AnalyzeRequest, PredictRequest } from '../../../../src/generated/server/worldmonitor/claude/v1/service_server';
import { handleSummarize } from './summarize';
import { handleAnalyze } from './analyze';
import { handlePredict } from './predict';

export const claudeHandler: ClaudeServiceHandler = {
  summarize: (_ctx: ServerContext, req: SummarizeRequest) => handleSummarize(req),
  analyze: (_ctx: ServerContext, req: AnalyzeRequest) => handleAnalyze(req),
  predict: (_ctx: ServerContext, req: PredictRequest) => handlePredict(req),
};
