import { z } from 'zod';

const clinicUserRole = z.enum(['admin', 'doctor', 'receptionist']);

export const CreateUserSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(2),
  title: z.string().min(2).optional(),
  email: z.string().email(),
  password: z.string().min(6),
  role: clinicUserRole,
  doctorCode: z.string().min(1).optional(),
});

export type CreateUserDto = z.infer<typeof CreateUserSchema>;
