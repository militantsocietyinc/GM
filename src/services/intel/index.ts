import { IntelServiceClient } from '../../generated/client/worldmonitor/intel/v1/service_client';
import type { ChatResponse, BriefingResponse } from '../../generated/client/worldmonitor/intel/v1/service_client';

const client = new IntelServiceClient('', { fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args) });

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function sendChatMessage(
  messages: ChatMessage[],
  region = '',
): Promise<ChatResponse> {
  return client.chat({ messages, region });
}

export async function generateBriefing(
  focusRegions: string[] = [],
  language = 'zh',
): Promise<BriefingResponse> {
  return client.briefing({ focusRegions, language });
}
