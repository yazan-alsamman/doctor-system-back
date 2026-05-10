import { z } from 'zod';

export const FinalizeSessionSchema = z.object({
  serviceIds: z.array(z.string().min(1)).min(1).optional(),
  discount: z.number().nonnegative().optional(),
  manualPriceOverride: z.number().nonnegative().optional(),
  consentObtained: z.boolean().optional(),
  treatmentDetails: z.string().max(4000).optional(),
  doctorRemarks: z.string().max(4000).optional(),
  specialConditions: z.string().max(4000).optional(),
  markCompleted: z.boolean().optional().default(true),
});

export type FinalizeSessionDto = z.infer<typeof FinalizeSessionSchema>;
