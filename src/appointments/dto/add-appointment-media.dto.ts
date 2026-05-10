import { z } from 'zod';

export const AddAppointmentMediaSchema = z.object({
  label: z.enum(['before', 'after']),
  // Enforce https:// or http:// to block javascript: URIs and internal network probing
  imageUrl: z
    .string()
    .url()
    .refine((u) => /^https?:\/\//i.test(u), {
      message: 'imageUrl must use https:// or http://',
    }),
});

export type AddAppointmentMediaDto = z.infer<typeof AddAppointmentMediaSchema>;
