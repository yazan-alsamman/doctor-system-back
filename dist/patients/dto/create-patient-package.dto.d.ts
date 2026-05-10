import { z } from 'zod';
export declare const CreatePatientPackageSchema: z.ZodObject<{
    serviceId: z.ZodString;
    totalSessions: z.ZodNumber;
    expiresAt: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type CreatePatientPackageDto = z.infer<typeof CreatePatientPackageSchema>;
