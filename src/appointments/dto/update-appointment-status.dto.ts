import { AppointmentStatus } from '@prisma/client';
import { z } from 'zod';

export const UpdateAppointmentStatusSchema = z.object({
  status: z.nativeEnum(AppointmentStatus),
  reason: z.string().max(500).optional(),
});

export type UpdateAppointmentStatusDto = z.infer<typeof UpdateAppointmentStatusSchema>;
