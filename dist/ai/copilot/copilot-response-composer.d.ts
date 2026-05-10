import type { ToolName } from './tools/tool.types';
export declare function extractPrimaryAssistantText(raw: string): string;
export interface ComposeOptions {
    language?: string;
}
export declare function composeCopilotAnswer(parsed: Record<string, unknown> | null, rawText: string, options?: ComposeOptions): {
    response: string;
    copilot_hints: Record<string, unknown>;
};
export declare function buildSearchNarrative(tool: ToolName | null | undefined, data: unknown, error: string | undefined, displayQuery: string, language?: string): string;
