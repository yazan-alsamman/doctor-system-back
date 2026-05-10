import { z } from 'zod';

export const RefundPaymentSchema = z.object({
  amount: z.union([z.number().positive(), z.string()]),
  reason: z.string().max(2000).optional(),
});

export type RefundPaymentDto = z.infer<typeof RefundPaymentSchema>;
