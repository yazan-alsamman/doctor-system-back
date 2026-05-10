import { z } from 'zod';

export const PayInvoiceSchema = z.object({
  paidAmount: z.number().positive().optional(),
  method: z.enum(['cash', 'card', 'transfer', 'other']).optional(),
  reference: z.string().max(120).optional(),
  // Client-generated key (UUID recommended) for idempotent retries.
  // If a payment with this key already exists, the server returns it unchanged.
  idempotencyKey: z.string().max(128).optional(),
});

export type PayInvoiceDto = z.infer<typeof PayInvoiceSchema>;
