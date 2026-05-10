import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { IntentType } from '../intent/intent.types';
import type { ToolName } from '../tools/tool.types';
import { ALL_TOOL_NAMES } from './tool-plan.schema';

const DOCTOR_FINANCE_TOOLS = new Set<ToolName>([
  'getInvoiceData',
  'getRevenueStats',
]);

/**
 * Tenant-safe and role-aware guardrails. All copilot tools are read-only today;
 * doctors cannot run tenant-wide finance aggregates.
 */
@Injectable()
export class CopilotPolicyService {
  allowedTools(role: UserRole): Set<ToolName> {
    if (role === UserRole.doctor) {
      return new Set(
        ALL_TOOL_NAMES.filter((t) => !DOCTOR_FINANCE_TOOLS.has(t)),
      );
    }
    return new Set(ALL_TOOL_NAMES);
  }

  intentAllowedForRole(role: UserRole, intent: IntentType): boolean {
    if (role === UserRole.doctor && intent === 'finance') {
      return false;
    }
    return true;
  }

  /** Elevated sensitivity — used by Brain for risk hints only. */
  intentSensitivity(intent: IntentType): 'normal' | 'high' {
    return intent === 'clinical' || intent === 'finance' ? 'high' : 'normal';
  }
}
