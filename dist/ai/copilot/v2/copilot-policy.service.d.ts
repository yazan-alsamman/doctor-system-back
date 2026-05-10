import { UserRole } from "@prisma/client";
import type { IntentType } from '../intent/intent.types';
import type { ToolName } from '../tools/tool.types';
export declare class CopilotPolicyService {
    allowedTools(role: UserRole): Set<ToolName>;
    intentAllowedForRole(role: UserRole, intent: IntentType): boolean;
    intentSensitivity(intent: IntentType): 'normal' | 'high';
}
