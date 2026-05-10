import { Plan } from '@prisma/client';
import { z } from 'zod';

export const CreateClinicSchema = z.object({
  clinicName: z.string().min(2).max(160),
  adminName: z.string().min(2).max(160),
  adminEmail: z.string().trim().toLowerCase().pipe(z.string().email()),
  adminPassword: z.string().min(8),
  plan: z.nativeEnum(Plan),
});

export type CreateClinicDto = z.infer<typeof CreateClinicSchema>;
