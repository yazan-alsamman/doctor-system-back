import { z } from 'zod';

export const SuperAdminLoginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.string().email()),
  password: z.string().min(6),
});

export type SuperAdminLoginDto = z.infer<typeof SuperAdminLoginSchema>;
