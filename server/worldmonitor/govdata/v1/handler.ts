import type { GovdataServiceHandler } from '../../../../src/generated/server/worldmonitor/govdata/v1/service_server';

import { listNotams } from './notam';

export const govdataHandler: GovdataServiceHandler = {
  listNotams,
};
