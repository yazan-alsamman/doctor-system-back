import { z } from 'zod';

export const CreateServiceSchema = z.object({
  id: z.string().min(1).optional(),
  doctorId: z.string().optional(),
  name: z.string().min(2),
  price: z.number().positive(),
  durationMinutes: z.number().int().positive(),
  category: z.string().min(2).optional(),
  aliases: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});

export type CreateServiceDto = z.infer<typeof CreateServiceSchema>;
