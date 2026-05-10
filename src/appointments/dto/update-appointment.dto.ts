import { z } from 'zod';

export const UpdateAppointmentSchema = z.object({
  patientId: z.string().min(1).optional(),
  doctorId: z.string().min(1).optional(),
  serviceId: z.string().min(1).optional(),
  serviceIds: z.array(z.string().min(1)).min(1).optional(),
  startTime: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
  overbooked: z.boolean().optional(),
  discount: z.number().nonnegative().optional(),
  manualPriceOverride: z.number().nonnegative().optional(),
  consentObtained: z.boolean().optional(),
  treatmentDetails: z.string().max(4000).optional(),
  doctorRemarks: z.string().max(4000).optional(),
  specialConditions: z.string().max(4000).optional(),
});

export type UpdateAppointmentDto = z.infer<typeof UpdateAppointmentSchema>;
