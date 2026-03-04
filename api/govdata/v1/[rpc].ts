export const config = { runtime: 'edge' };

import { createDomainGateway, serverOptions } from '../../../server/gateway';
import { createGovdataServiceRoutes } from '../../../src/generated/server/worldmonitor/govdata/v1/service_server';
import { govdataHandler } from '../../../server/worldmonitor/govdata/v1/handler';
import { checkKillswitch } from '../../../server/_shared/killswitch';

const routes = createGovdataServiceRoutes(govdataHandler, serverOptions);
const gateway = createDomainGateway(routes);

export default async function handler(req: Request): Promise<Response> {
  const disabled = checkKillswitch('GOVDATA');
  if (disabled) return disabled;
  return gateway(req);
}
