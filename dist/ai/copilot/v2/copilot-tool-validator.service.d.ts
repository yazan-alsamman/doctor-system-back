import type { AuthContext } from '../../../common/auth-context';
import { type ValidatedToolPlan } from './tool-plan.schema';
import { CopilotPolicyService } from './copilot-policy.service';
import type { ToolPlan } from './copilot-v2.types';
export declare class CopilotToolValidatorService {
    private readonly policy;
    constructor(policy: CopilotPolicyService);
    validateAndParse(plan: ToolPlan, auth: AuthContext): ValidatedToolPlan;
    private sanitizeArgs;
    private assertUuidLikeIds;
}
