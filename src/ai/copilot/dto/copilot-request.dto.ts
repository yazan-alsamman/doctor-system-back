import { z } from 'zod';

export const CopilotRequestSchema = z.object({
  input: z.string().min(1).max(4000),
  /** Optional — ties into {@link CopilotMemoryService} for follow-up context. */
  sessionId: z.string().uuid().optional(),
  context: z
    .object({
      patientId: z.string().optional(),
      doctorId: z.string().optional(),
      dateRange: z
        .object({
          from: z.string().optional(),
          to: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

export type CopilotRequestDto = z.infer<typeof CopilotRequestSchema>;
