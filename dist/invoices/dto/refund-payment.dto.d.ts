import { z } from 'zod';
export declare const RefundPaymentSchema: z.ZodObject<{
    amount: z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>;
    reason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type RefundPaymentDto = z.infer<typeof RefundPaymentSchema>;
