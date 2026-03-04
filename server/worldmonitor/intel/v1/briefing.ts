/**
 * Briefing Handler — generates structured intelligence briefings via Claude tool use.
 *
 * Similar to the chat handler but with:
 *   - BRIEFING_SYSTEM_PROMPT (structured framework with 5 sections)
 *   - Higher token limit (8192) and max tool turns (8)
 *   - Structured output: sections with title/content/sources
 *   - 90s timeout for longer data-gathering chains
 *
 * SENTINEL: This file is part of the Intelligence Assistant module.
 */

import { TOOL_DEFINITIONS, executeToolCall } from './tools.ts';
import { BRIEFING_SYSTEM_PROMPT, INTEL_DISCLAIMER } from './system-prompts.ts';
import { extractJson } from '../../../../src/utils/ai-response.ts';
import { trackUsage } from '../../claude/v1/spend-tracker.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SONNET_MODEL = 'claude-sonnet-4-20250514';
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const MAX_TOOL_TURNS = 8;
const TIMEOUT_MS = 90_000;
const MAX_TOKENS = 8192;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BriefingInput {
  focusRegions: string[];
  language: string;
}

export interface BriefingSection {
  title: string;
  content: string;
  sources: string[];
}

export interface BriefingOutput {
  status: 'ok' | 'error';
  sections: BriefingSection[];
  generatedAt: number;
  tokensUsed: { input: number; output: number };
  disclaimer: string;
  errorMessage: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ERROR_RESULT: BriefingOutput = {
  status: 'error',
  sections: [],
  generatedAt: 0,
  tokensUsed: { input: 0, output: 0 },
  disclaimer: INTEL_DISCLAIMER,
  errorMessage: '',
};

function buildUserMessage(focusRegions: string[], language: string): string {
  const lang = language || 'zh';
  const base = lang === 'zh'
    ? '请生成今日情报简报，自动判断当前最重要的热点。'
    : 'Generate today\'s intelligence briefing, automatically identify the most important hotspots.';

  if (focusRegions.length > 0) {
    const regionStr = focusRegions.join(', ');
    return lang === 'zh'
      ? `请生成今日情报简报，重点关注以下地区：${regionStr}。同时也覆盖其他重要热点。`
      : `Generate today's intelligence briefing, focusing on: ${regionStr}. Also cover other important hotspots.`;
  }

  return base;
}

function buildSystemPrompt(language: string): string {
  const lang = language || 'zh';
  const langInstruction = lang === 'zh'
    ? '\n\n请用中文撰写简报。'
    : `\n\nWrite the briefing in ${lang}.`;

  const outputFormat = `

输出格式要求：
请以 JSON 格式输出最终简报，格式如下：
\`\`\`json
{
  "sections": [
    { "title": "章节标题", "content": "章节内容...", "sources": ["数据来源1", "数据来源2"] }
  ]
}
\`\`\``;

  return BRIEFING_SYSTEM_PROMPT + langInstruction + outputFormat;
}

function parseSections(text: string, toolsUsed: string[]): BriefingSection[] {
  try {
    const parsed = extractJson<{ sections: BriefingSection[] }>(text);
    if (Array.isArray(parsed.sections) && parsed.sections.length > 0) {
      return parsed.sections.map(s => ({
        title: s.title ?? '',
        content: s.content ?? '',
        sources: Array.isArray(s.sources) ? s.sources : [],
      }));
    }
  } catch { /* fall through to plain-text wrapping */ }

  // Wrap plain text as a single section
  return [{
    title: '情报简报',
    content: text,
    sources: [...new Set(toolsUsed)],
  }];
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function handleBriefing(input: BriefingInput): Promise<BriefingOutput> {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return { ...ERROR_RESULT, errorMessage: 'Claude API key not configured' };
  }

  const language = input.language || 'zh';
  const systemPrompt = buildSystemPrompt(language);
  const userMessage = buildUserMessage(input.focusRegions, language);

  const messages: Array<{ role: string; content: any }> = [
    { role: 'user', content: userMessage },
  ];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const toolsUsed: string[] = [];

  try {
    for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(ANTHROPIC_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: SONNET_MODEL,
          max_tokens: MAX_TOKENS,
          system: systemPrompt,
          messages,
          tools: TOOL_DEFINITIONS,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        return { ...ERROR_RESULT, errorMessage: `Claude API error: ${response.status}` };
      }

      const data = await response.json() as any;
      const usage = data.usage ?? {};
      totalInputTokens += usage.input_tokens ?? 0;
      totalOutputTokens += usage.output_tokens ?? 0;

      const contentBlocks: any[] = data.content ?? [];
      const stopReason: string = data.stop_reason ?? 'end_turn';

      // Check for tool_use blocks
      const toolUseBlocks = contentBlocks.filter((b: any) => b.type === 'tool_use');

      if (stopReason !== 'tool_use' || toolUseBlocks.length === 0) {
        // Final response — extract text
        const fullText = contentBlocks
          .filter((b: any) => b.type === 'text')
          .map((b: any) => b.text)
          .join('\n');

        trackUsage(totalInputTokens, totalOutputTokens, 'sonnet');

        const sections = parseSections(fullText, toolsUsed);

        return {
          status: 'ok',
          sections,
          generatedAt: Date.now(),
          tokensUsed: { input: totalInputTokens, output: totalOutputTokens },
          disclaimer: INTEL_DISCLAIMER,
          errorMessage: '',
        };
      }

      // Append assistant message (with tool_use blocks)
      messages.push({ role: 'assistant', content: contentBlocks });

      // Execute each tool call and collect results
      const toolResults: any[] = [];
      for (const block of toolUseBlocks) {
        toolsUsed.push(block.name);
        const result = await executeToolCall(block.name, block.input ?? {});
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }

      messages.push({ role: 'user', content: toolResults });
    }

    // Exhausted tool turns — request a final answer without tools
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    messages.push({ role: 'user', content: '请基于已获取的数据，直接输出最终简报（JSON格式）。' });

    const finalResponse = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: SONNET_MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!finalResponse.ok) {
      return { ...ERROR_RESULT, errorMessage: `Claude API error (final): ${finalResponse.status}` };
    }

    const finalData = await finalResponse.json() as any;
    const finalUsage = finalData.usage ?? {};
    totalInputTokens += finalUsage.input_tokens ?? 0;
    totalOutputTokens += finalUsage.output_tokens ?? 0;

    trackUsage(totalInputTokens, totalOutputTokens, 'sonnet');

    const fullText = (finalData.content ?? [])
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n');

    const sections = parseSections(fullText, toolsUsed);

    return {
      status: 'ok',
      sections,
      generatedAt: Date.now(),
      tokensUsed: { input: totalInputTokens, output: totalOutputTokens },
      disclaimer: INTEL_DISCLAIMER,
      errorMessage: '',
    };
  } catch (err) {
    return { ...ERROR_RESULT, errorMessage: err instanceof Error ? err.message : 'Unknown error' };
  }
}
