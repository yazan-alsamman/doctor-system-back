import { Plan, SubscriptionStatus, TenantStatus } from '@prisma/client';
import { z } from 'zod';

export const PatchTenantSchema = z
  .object({
    name: z.string().min(2).max(160).optional(),
    status: z.nativeEnum(TenantStatus).optional(),
    plan: z.nativeEnum(Plan).optional(),
    subscriptionStatus: z.nativeEnum(SubscriptionStatus).optional(),
    nextBillingDate: z.coerce.date().nullable().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'At least one field required' });

export type PatchTenantDto = z.infer<typeof PatchTenantSchema>;
