import { z } from 'zod';

export const UpdateServiceSchema = z.object({
  name: z.string().min(2).optional(),
  price: z.number().positive().optional(),
  durationMinutes: z.number().int().positive().optional(),
  category: z.string().min(2).optional(),
  aliases: z.array(z.string()).optional(),
  active: z.boolean().optional(),
  doctorId: z.string().nullable().optional(),
});

export type UpdateServiceDto = z.infer<typeof UpdateServiceSchema>;
