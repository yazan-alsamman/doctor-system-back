import { z } from 'zod';

const clinicUserRole = z.enum(['admin', 'doctor', 'receptionist']);

export const UpdateUserSchema = z.object({
  name: z.string().min(2).optional(),
  title: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: clinicUserRole.optional(),
  doctorCode: z.string().min(1).nullable().optional(),
  active: z.boolean().optional(),
  /** Full desired access tree; server stores minimal JSON diff vs role defaults. Pass null to reset overrides. */
  access: z.any().nullable().optional(),
});

export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;
