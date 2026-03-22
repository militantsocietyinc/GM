import type {
  ServerContext,
  GetGdeltTopicTimelineRequest,
  GetGdeltTopicTimelineResponse,
} from '../../../../src/generated/server/worldmonitor/intelligence/v1/service_server';

import { getCachedJson } from '../../../_shared/redis';

const VALID_TOPICS = new Set(['military', 'cyber', 'nuclear', 'sanctions', 'intelligence', 'maritime']);

export async function getGdeltTopicTimeline(
  _ctx: ServerContext,
  req: GetGdeltTopicTimelineRequest,
): Promise<GetGdeltTopicTimelineResponse> {
  const topic = (req.topic ?? '').trim().toLowerCase();
  if (!topic || !VALID_TOPICS.has(topic)) {
    return { topic, tone: [], vol: [], fetchedAt: '', error: 'invalid topic' };
  }

  try {
    const [toneData, volData] = await Promise.all([
      getCachedJson(`gdelt:intel:tone:${topic}`, true),
      getCachedJson(`gdelt:intel:vol:${topic}`, true),
    ]);

    const tone = Array.isArray(toneData) ? toneData : [];
    const vol = Array.isArray(volData) ? volData : [];
    const fetchedAt = tone.length > 0 || vol.length > 0 ? new Date().toISOString() : '';

    return { topic, tone, vol, fetchedAt, error: '' };
  } catch {
    return { topic, tone: [], vol: [], fetchedAt: '', error: 'unavailable' };
  }
}
