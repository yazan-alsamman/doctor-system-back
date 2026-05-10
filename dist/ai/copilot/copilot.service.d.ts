import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { CopilotPresenterService } from './copilot-presenter.service';
import { ToolRegistryService } from './tools/tool-registry.service';
import { ContextBuilderService } from './context/context-builder.service';
import { IntentDetectorService } from './intent/intent-detector.service';
import { CopilotMemoryService } from './v2/copilot-memory.service';
import { CopilotExecutionEngine } from './v2/copilot-execution.engine';
import { CopilotReasoningService } from './v2/copilot-reasoning.service';
import type { AuthContext } from '../../common/auth-context';
import type { CopilotRequestDto } from './dto/copilot-request.dto';
export interface CopilotResponse {
    intent: string;
    tool_used: string | null;
    response: string;
    structured_data: Record<string, unknown> | null;
    metadata: {
        confidence: string;
        language: string;
        model_used: string;
        processing_time_ms: number;
    };
}
export declare class CopilotService {
    private readonly intentDetector;
    private readonly execution;
    private readonly memory;
    private readonly reasoning;
    private readonly presenter;
    private readonly toolRegistry;
    private readonly contextBuilder;
    private readonly config;
    private readonly logger;
    constructor(intentDetector: IntentDetectorService, execution: CopilotExecutionEngine, memory: CopilotMemoryService, reasoning: CopilotReasoningService, presenter: CopilotPresenterService, toolRegistry: ToolRegistryService, contextBuilder: ContextBuilderService, config: ConfigService);
    process(dto: CopilotRequestDto, auth: AuthContext): Promise<CopilotResponse>;
    processStream(dto: CopilotRequestDto, auth: AuthContext, res: Response): Promise<void>;
    private modelForIntent;
    private maxTokensForAnswer;
    private expectsStructuredJsonAnswer;
    private finalizeUserFacingReply;
    private renderPrompt;
    private formatAssistantReply;
    private primaryTool;
    private attachToolMetadata;
    private persistMemory;
    private processSearchIntent;
    private nlSearchHeuristicPlan;
    private buildSearchFallbackToolPlans;
}
