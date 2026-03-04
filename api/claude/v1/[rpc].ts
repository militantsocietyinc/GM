export const config = { runtime: 'edge' };

import { createDomainGateway, serverOptions } from '../../../server/gateway';
import { createClaudeServiceRoutes } from '../../../src/generated/server/worldmonitor/claude/v1/service_server';
import { claudeHandler } from '../../../server/worldmonitor/claude/v1/handler';
import { checkKillswitch } from '../../../server/_shared/killswitch';
import { isBudgetExceeded } from '../../../server/worldmonitor/claude/v1/spend-tracker';

const routes = createClaudeServiceRoutes(claudeHandler, serverOptions);
const gateway = createDomainGateway(routes);

export default async function handler(req: Request): Promise<Response> {
  const disabled = checkKillswitch('CLAUDE');
  if (disabled) return disabled;

  if (isBudgetExceeded()) {
    return new Response(
      JSON.stringify({ error: 'Daily Claude budget exceeded', status: 'budget_exceeded' }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '3600' } },
    );
  }

  return gateway(req);
}
