import { z } from 'zod';

export const ParseBookingSchema = z.object({
  text: z.string().min(1).max(8000),
  /** Client "now" in ISO — improves غداً / بعد غد / نهاية الأسبوع relative to the real calendar */
  referenceDateIso: z.string().min(8).max(64).optional(),
  doctors: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        dept: z.string().optional(),
      }),
    )
    .min(1),
  patients: z
    .array(
      z.object({
        name: z.string().min(1),
      }),
    )
    .optional(),
});

export type ParseBookingDto = z.infer<typeof ParseBookingSchema>;
