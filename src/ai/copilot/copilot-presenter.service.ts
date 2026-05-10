import { Injectable } from '@nestjs/common';
import {
  buildSearchNarrative,
  composeCopilotAnswer,
  extractPrimaryAssistantText,
} from './copilot-response-composer';
import { CopilotReasoningService } from './v2/copilot-reasoning.service';
import type { ToolName } from './tools/tool.types';

export interface ComposeLlmResult {
  response: string;
  structuredData: Record<string, unknown> | null;
}

/**
 * Presentation layer: Arabic/English UX, bullets, UI hints — no LLM calls.
 */
@Injectable()
export class CopilotPresenterService {
  constructor(private readonly reasoning: CopilotReasoningService) {}

  composeFromLlmJson(
    rawText: string,
    intent: string,
    options?: { language?: string },
  ): ComposeLlmResult {
    const fallback = rawText.trim() || '—';
    if (intent === 'general') {
      return { response: fallback, structuredData: null };
    }

    try {
      const parsed = this.reasoning.parseJson<Record<string, unknown>>(rawText);
      const composed = composeCopilotAnswer(parsed, rawText, {
        language: options?.language,
      });
      return {
        response: composed.response,
        structuredData: {
          ...parsed,
          ...(Object.keys(composed.copilot_hints).length
            ? { copilot_hints: composed.copilot_hints }
            : {}),
        },
      };
    } catch {
      return {
        response: extractPrimaryAssistantText(rawText),
        structuredData: null,
      };
    }
  }

  buildSearchNarrative(
    tool: ToolName | null | undefined,
    data: unknown,
    error: string | undefined,
    displayQuery: string,
    language?: string,
  ): string {
    return buildSearchNarrative(tool, data, error, displayQuery, language);
  }
}
