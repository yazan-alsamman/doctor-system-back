import { z } from 'zod';
export declare const PatchTenantSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<{
        active: "active";
        suspended: "suspended";
        trial: "trial";
    }>>;
    plan: z.ZodOptional<z.ZodEnum<{
        basic: "basic";
        pro: "pro";
    }>>;
    subscriptionStatus: z.ZodOptional<z.ZodEnum<{
        active: "active";
        expired: "expired";
        trial: "trial";
    }>>;
    nextBillingDate: z.ZodOptional<z.ZodNullable<z.ZodCoercedDate<unknown>>>;
}, z.core.$strip>;
export type PatchTenantDto = z.infer<typeof PatchTenantSchema>;
