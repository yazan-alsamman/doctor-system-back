import type { AuthContext } from '../../../common/auth-context';
import { ToolRegistryService } from '../tools/tool-registry.service';
import type { ToolResult } from '../tools/tool.types';
import { CopilotToolValidatorService } from './copilot-tool-validator.service';
import type { ToolPlan } from './copilot-v2.types';
export declare class CopilotExecutionEngine {
    private readonly registry;
    private readonly validator;
    private readonly logger;
    constructor(registry: ToolRegistryService, validator: CopilotToolValidatorService);
    execute(auth: AuthContext, plans: ToolPlan[]): Promise<ToolResult[]>;
}
