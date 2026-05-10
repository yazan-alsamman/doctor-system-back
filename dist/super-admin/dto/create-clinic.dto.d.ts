import { z } from 'zod';
export declare const CreateClinicSchema: z.ZodObject<{
    clinicName: z.ZodString;
    adminName: z.ZodString;
    adminEmail: z.ZodPipe<z.ZodString, z.ZodString>;
    adminPassword: z.ZodString;
    plan: z.ZodEnum<{
        basic: "basic";
        pro: "pro";
    }>;
}, z.core.$strip>;
export type CreateClinicDto = z.infer<typeof CreateClinicSchema>;
