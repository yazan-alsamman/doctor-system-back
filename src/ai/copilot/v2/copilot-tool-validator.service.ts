import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { AuthContext } from '../../../common/auth-context';
import type { ToolName } from '../tools/tool.types';
import { ToolPlanSchema, type ValidatedToolPlan } from './tool-plan.schema';
import { CopilotPolicyService } from './copilot-policy.service';
import type { ToolPlan } from './copilot-v2.types';
import {
  assertSearchExecutionArgs,
  isSearchToolName,
} from './search-tool-args';

const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype']);

@Injectable()
export class CopilotToolValidatorService {
  constructor(private readonly policy: CopilotPolicyService) {}

  /**
   * Zod shape + policy allow-list + prototype-pollution guard.
   * Does not throw on soft issues — rethrows on policy violation.
   */
  validateAndParse(plan: ToolPlan, auth: AuthContext): ValidatedToolPlan {
    const allowed = this.policy.allowedTools(auth.role);
    if (!allowed.has(plan.tool)) {
      throw new ForbiddenException({
        message: 'Tool not allowed for this role',
        code: 'COPILOT_TOOL_FORBIDDEN',
        status: 403,
      });
    }

    const safeArgs = this.sanitizeArgs(plan.args);
    const candidate: ToolPlan = { ...plan, args: safeArgs };

    const parsed = ToolPlanSchema.safeParse(candidate);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Invalid tool plan',
        code: 'COPILOT_PLAN_INVALID',
        status: 400,
        details: parsed.error.flatten(),
      });
    }

    const base = parsed.data;
    if (isSearchToolName(base.tool)) {
      const args = assertSearchExecutionArgs(base.tool, base.args);
      this.assertUuidLikeIds(base.tool, args);
      return { ...base, args };
    }

    this.assertUuidLikeIds(base.tool, base.args);
    return base;
  }

  private sanitizeArgs(args: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    let n = 0;
    for (const [k, v] of Object.entries(args)) {
      if (n++ > 80) break;
      if (FORBIDDEN.has(k)) continue;
      if (k.length > 256) continue;
      out[k] = v;
    }
    return out;
  }

  private assertUuidLikeIds(tool: ToolName, args: Record<string, unknown>) {
    for (const key of ['patientId', 'doctorId'] as const) {
      const v = args[key];
      if (v === undefined || v === null) continue;
      const s = String(v).trim();
      if (!s) continue;
      if (!z.string().uuid().safeParse(s).success) {
        throw new BadRequestException({
          message: `Invalid ${key} (expected UUID)`,
          code: 'COPILOT_ID_INVALID',
          status: 400,
          details: { tool, key },
        });
      }
    }
  }
}
