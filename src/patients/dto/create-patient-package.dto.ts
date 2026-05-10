import { z } from 'zod';

export const CreatePatientPackageSchema = z.object({
  serviceId: z.string().min(1),
  totalSessions: z.number().int().min(1).max(60),
  expiresAt: z.string().datetime().optional(),
});

export type CreatePatientPackageDto = z.infer<typeof CreatePatientPackageSchema>;
