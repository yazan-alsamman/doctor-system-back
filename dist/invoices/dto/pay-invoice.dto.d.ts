import { z } from 'zod';
export declare const PayInvoiceSchema: z.ZodObject<{
    paidAmount: z.ZodOptional<z.ZodNumber>;
    method: z.ZodOptional<z.ZodEnum<{
        other: "other";
        cash: "cash";
        card: "card";
        transfer: "transfer";
    }>>;
    reference: z.ZodOptional<z.ZodString>;
    idempotencyKey: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type PayInvoiceDto = z.infer<typeof PayInvoiceSchema>;
