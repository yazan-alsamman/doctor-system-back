import { z } from 'zod';

export const CreateNextSessionSchema = z.object({
  intervalDays: z.number().int().min(1).max(90).optional().default(14),
  repeatCount: z.number().int().min(1).max(6).optional().default(1),
  allowOverbook: z.boolean().optional().default(false),
});

export type CreateNextSessionDto = z.infer<typeof CreateNextSessionSchema>;
