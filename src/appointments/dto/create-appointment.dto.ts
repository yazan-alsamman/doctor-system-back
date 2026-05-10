import { z } from 'zod';

export const CreateAppointmentSchema = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().min(1),
  serviceId: z.string().min(1),
  serviceIds: z.array(z.string().min(1)).min(1).optional(),
  startTime: z.string().datetime(),
  allowOverbook: z.boolean().optional().default(false),
  notes: z.string().max(2000).optional(),
  discount: z.number().nonnegative().optional(),
  manualPriceOverride: z.number().nonnegative().optional(),
  consentObtained: z.boolean().optional(),
  treatmentDetails: z.string().max(4000).optional(),
  doctorRemarks: z.string().max(4000).optional(),
  specialConditions: z.string().max(4000).optional(),
});

export type CreateAppointmentDto = z.infer<typeof CreateAppointmentSchema>;
