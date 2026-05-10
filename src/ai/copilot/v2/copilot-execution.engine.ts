import { Injectable, Logger } from '@nestjs/common';
import type { AuthContext } from '../../../common/auth-context';
import { ToolRegistryService } from '../tools/tool-registry.service';
import type { ToolResult } from '../tools/tool.types';
import { CopilotToolValidatorService } from './copilot-tool-validator.service';
import type { ToolPlan } from './copilot-v2.types';

/**
 * Deterministic, auditable execution: validate each plan then dispatch.
 */
@Injectable()
export class CopilotExecutionEngine {
  private readonly logger = new Logger(CopilotExecutionEngine.name);

  constructor(
    private readonly registry: ToolRegistryService,
    private readonly validator: CopilotToolValidatorService,
  ) {}

  async execute(
    auth: AuthContext,
    plans: ToolPlan[],
  ): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    const settled = await Promise.allSettled(
      plans.map(async (plan) => {
        const validated = this.validator.validateAndParse(plan, auth);
        return this.registry.executeTool(validated.tool, auth, validated.args);
      }),
    );

    settled.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        this.logger.warn(
          `Plan ${plans[i]?.tool} failed: ${String(result.reason).slice(0, 180)}`,
        );
        results.push({
          tool: plans[i]!.tool,
          data: null,
          error: 'validation_or_execution_failed',
        });
      }
    });

    return results;
  }
}
