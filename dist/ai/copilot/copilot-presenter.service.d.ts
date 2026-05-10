import { CopilotReasoningService } from './v2/copilot-reasoning.service';
import type { ToolName } from './tools/tool.types';
export interface ComposeLlmResult {
    response: string;
    structuredData: Record<string, unknown> | null;
}
export declare class CopilotPresenterService {
    private readonly reasoning;
    constructor(reasoning: CopilotReasoningService);
    composeFromLlmJson(rawText: string, intent: string, options?: {
        language?: string;
    }): ComposeLlmResult;
    buildSearchNarrative(tool: ToolName | null | undefined, data: unknown, error: string | undefined, displayQuery: string, language?: string): string;
}
