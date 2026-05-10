import { z } from 'zod';
import type { ToolName } from '../tools/tool.types';

export const ALL_TOOL_NAMES = [
  'getAvailableSlots',
  'getDoctorSchedule',
  'detectConflicts',
  'getPatientHistory',
  'getPatientSummary',
  'getInvoiceData',
  'getRevenueStats',
  'generateWhatsAppMessage',
  'searchAppointments',
  'searchPatients',
  'searchInvoices',
] as const satisfies readonly ToolName[];

const MAX_ARG_KEYS = 40;
const MAX_STRING_LEN = 8000;

function depthOf(obj: unknown, d = 0): number {
  if (d > 8) return 9;
  if (obj === null || typeof obj !== 'object') return d;
  if (Array.isArray(obj)) {
    let m = d;
    for (const x of obj.slice(0, 50)) m = Math.max(m, depthOf(x, d + 1));
    return m;
  }
  const o = obj as Record<string, unknown>;
  let m = d;
  for (const k of Object.keys(o).slice(0, MAX_ARG_KEYS)) {
    m = Math.max(m, depthOf(o[k], d + 1));
  }
  return m;
}

/** Validates shape only — role/tenant checks live in {@link CopilotPolicyService} / validator. */
export const ToolPlanSchema = z.object({
  tool: z.enum(ALL_TOOL_NAMES),
  args: z
    .record(z.string(), z.unknown())
    .superRefine((args, ctx) => {
      const keys = Object.keys(args);
      if (keys.length > MAX_ARG_KEYS) {
        ctx.addIssue({ code: 'custom', message: 'too_many_arg_keys' });
      }
      if (depthOf(args) > 7) {
        ctx.addIssue({ code: 'custom', message: 'args_too_deep' });
      }
      for (const [k, v] of Object.entries(args)) {
        if (['__proto__', 'constructor', 'prototype'].includes(k)) {
          ctx.addIssue({ code: 'custom', message: `forbidden_key:${k}` });
        }
        if (typeof v === 'string' && v.length > MAX_STRING_LEN) {
          ctx.addIssue({ code: 'custom', message: `string_too_long:${k}` });
        }
      }
    }),
  reason: z.string().max(2000),
});

export type ValidatedToolPlan = z.infer<typeof ToolPlanSchema>;
