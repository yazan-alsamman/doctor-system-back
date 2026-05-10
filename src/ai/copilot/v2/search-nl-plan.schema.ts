import { z } from 'zod';

/** NL planner JSON — LLM output must match before building a {@link ToolPlan}. */
const SearchFiltersPatients = z
  .object({
    q: z.string().max(2000).optional(),
    name: z.string().max(500).optional(),
    phone: z.string().max(120).optional(),
    patientName: z.string().max(500).optional(),
    patient_name: z.string().max(500).optional(),
    from: z.string().max(80).optional(),
    to: z.string().max(80).optional(),
  })
  .strict();

const SearchFiltersAppointments = z
  .object({
    patientName: z.string().max(500).optional(),
    patient_name: z.string().max(500).optional(),
    doctorId: z.string().uuid().optional(),
    from: z.string().max(80).optional(),
    to: z.string().max(80).optional(),
    status: z.string().max(40).optional(),
    isListingQuery: z.boolean().optional(),
  })
  .strict();

const SearchFiltersInvoices = z
  .object({
    patientName: z.string().max(500).optional(),
    patient_name: z.string().max(500).optional(),
    from: z.string().max(80).optional(),
    to: z.string().max(80).optional(),
    unpaid: z.boolean().optional(),
    status: z.string().max(40).optional(),
  })
  .strict();

export const SearchNlPlanSchema = z.discriminatedUnion('tool', [
  z.object({
    tool: z.literal('searchPatients'),
    filters: SearchFiltersPatients.optional(),
    display_query: z.string().max(4000).optional(),
    confidence: z.union([z.enum(['high', 'medium', 'low']), z.string().max(32)]).optional(),
  }),
  z.object({
    tool: z.literal('searchAppointments'),
    filters: SearchFiltersAppointments.optional(),
    display_query: z.string().max(4000).optional(),
    confidence: z.union([z.enum(['high', 'medium', 'low']), z.string().max(32)]).optional(),
  }),
  z.object({
    tool: z.literal('searchInvoices'),
    filters: SearchFiltersInvoices.optional(),
    display_query: z.string().max(4000).optional(),
    confidence: z.union([z.enum(['high', 'medium', 'low']), z.string().max(32)]).optional(),
  }),
]);

export type ParsedNlSearchPlan = z.infer<typeof SearchNlPlanSchema>;

/** Legacy export name for callers that referenced StructuredSearchPlan. */
export type StructuredSearchPlan = ParsedNlSearchPlan;

/**
 * Parse arbitrary JSON from LLM — returns success only for schema-safe plans.
 */
export function safeParseNlSearchPlan(
  data: unknown,
): ReturnType<typeof SearchNlPlanSchema.safeParse> {
  return SearchNlPlanSchema.safeParse(data);
}
