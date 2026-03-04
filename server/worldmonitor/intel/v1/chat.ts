/**
 * Chat handler — Claude tool-use loop for the Intelligence Assistant.
 *
 * Sends user messages + tool definitions to Claude. When Claude responds with
 * tool_use blocks, executes them via the tool registry and feeds results back.
 * Repeats until Claude gives a text response or the turn limit is reached.
 *
 * SENTINEL: This file is part of the Intelligence Assistant module.
 */

import { TOOL_DEFINITIONS, executeToolCall } from './tools.ts';
import { CHAT_SYSTEM_PROMPT, INTEL_DISCLAIMER } from './system-prompts.ts';
import { trackUsage } from '../../claude/v1/spend-tracker.ts';

// ========================================================================
// Constants
// ========================================================================

const MODEL_ID = 'claude-sonnet-4-20250514';
const API_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const MAX_TOOL_TURNS = 5;
const API_TIMEOUT_MS = 60_000;
const MAX_TOKENS = 4096;

// ========================================================================
// Types (inline — no proto dependency)
// ========================================================================

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

interface ContentBlock {
  type: string;
  [key: string]: unknown;
}

interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface TextBlock {
  type: 'text';
  text: string;
}

interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

interface ApiResponse {
  content: ContentBlock[];
  usage: { input_tokens: number; output_tokens: number };
  stop_reason: string;
}

export interface ChatInput {
  messages: Array<{ role: string; content: string }>;
  region: string;
}

export interface ChatOutput {
  status: 'ok' | 'error';
  reply: string;
  toolsUsed: string[];
  tokensUsed: { input: number; output: number };
  disclaimer: string;
  errorMessage: string;
}

// ========================================================================
// Helpers
// ========================================================================

function makeErrorResult(errorMessage: string): ChatOutput {
  return {
    status: 'error',
    reply: '',
    toolsUsed: [],
    tokensUsed: { input: 0, output: 0 },
    disclaimer: INTEL_DISCLAIMER,
    errorMessage,
  };
}

function extractTextFromContent(content: ContentBlock[]): string {
  return content
    .filter((b): b is TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

function extractToolUseFromContent(content: ContentBlock[]): ToolUseBlock[] {
  return content.filter((b): b is ToolUseBlock => b.type === 'tool_use');
}

async function callClaudeApi(
  apiKey: string,
  messages: ChatMessage[],
): Promise<ApiResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL_ID,
        max_tokens: MAX_TOKENS,
        system: CHAT_SYSTEM_PROMPT,
        messages,
        tools: TOOL_DEFINITIONS,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Claude API returned ${response.status}`);
    }

    return (await response.json()) as ApiResponse;
  } finally {
    clearTimeout(timeout);
  }
}

// ========================================================================
// Main handler
// ========================================================================

export async function handleChat(input: ChatInput): Promise<ChatOutput> {
  // --- Validate input ---
  if (!input.messages || input.messages.length === 0) {
    return makeErrorResult('Messages array must not be empty.');
  }

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return makeErrorResult('CLAUDE_API_KEY is not configured. Please set the API key.');
  }

  // --- Build conversation messages ---
  const messages: ChatMessage[] = input.messages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  const toolsUsed: string[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // --- Tool-use loop ---
  try {
    for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
      const apiResponse = await callClaudeApi(apiKey, messages);

      totalInputTokens += apiResponse.usage.input_tokens;
      totalOutputTokens += apiResponse.usage.output_tokens;

      // If Claude is done (text response), return it
      if (apiResponse.stop_reason === 'end_turn') {
        const reply = extractTextFromContent(apiResponse.content);

        trackUsage(totalInputTokens, totalOutputTokens, 'sonnet');

        return {
          status: 'ok',
          reply,
          toolsUsed,
          tokensUsed: { input: totalInputTokens, output: totalOutputTokens },
          disclaimer: INTEL_DISCLAIMER,
          errorMessage: '',
        };
      }

      // If Claude wants to use tools, execute them
      if (apiResponse.stop_reason === 'tool_use') {
        const toolCalls = extractToolUseFromContent(apiResponse.content);

        if (toolCalls.length === 0) {
          // Unexpected: stop_reason is tool_use but no tool_use blocks
          break;
        }

        // Add assistant's response (with tool_use blocks) to conversation
        messages.push({ role: 'assistant', content: apiResponse.content });

        // Execute each tool call and build result blocks
        const toolResults: ToolResultBlock[] = [];
        for (const call of toolCalls) {
          toolsUsed.push(call.name);
          const result = await executeToolCall(call.name, call.input);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: call.id,
            content: JSON.stringify(result),
          });
        }

        // Add tool results as a user message
        messages.push({ role: 'user', content: toolResults as any });
        continue;
      }

      // Unknown stop_reason — treat as done
      const reply = extractTextFromContent(apiResponse.content);
      trackUsage(totalInputTokens, totalOutputTokens, 'sonnet');
      return {
        status: 'ok',
        reply: reply || 'No response generated.',
        toolsUsed,
        tokensUsed: { input: totalInputTokens, output: totalOutputTokens },
        disclaimer: INTEL_DISCLAIMER,
        errorMessage: '',
      };
    }

    // Exhausted max turns — return whatever we have
    trackUsage(totalInputTokens, totalOutputTokens, 'sonnet');
    return {
      status: 'ok',
      reply: '已达到最大工具调用轮次，以下是基于已获取数据的分析。',
      toolsUsed,
      tokensUsed: { input: totalInputTokens, output: totalOutputTokens },
      disclaimer: INTEL_DISCLAIMER,
      errorMessage: '',
    };
  } catch (err: unknown) {
    trackUsage(totalInputTokens, totalOutputTokens, 'sonnet');
    const message = err instanceof Error ? err.message : String(err);
    return makeErrorResult(message);
  }
}
