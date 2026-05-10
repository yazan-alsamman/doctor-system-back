import type { IntentType } from '../intent/intent.types';
import type { ToolResult } from '../tools/tool.types';
export declare class ContextBuilderService {
    private readonly logger;
    private readonly cache;
    buildContextString(intent: IntentType, toolResults: ToolResult[], tenantId: string): string;
    private format;
    private formatTool;
    private slimJson;
    private makeCacheKey;
    private evictStale;
}
