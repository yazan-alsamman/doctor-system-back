import { z } from 'zod';
export declare const FinalizeSessionSchema: z.ZodObject<{
    serviceIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    discount: z.ZodOptional<z.ZodNumber>;
    manualPriceOverride: z.ZodOptional<z.ZodNumber>;
    consentObtained: z.ZodOptional<z.ZodBoolean>;
    treatmentDetails: z.ZodOptional<z.ZodString>;
    doctorRemarks: z.ZodOptional<z.ZodString>;
    specialConditions: z.ZodOptional<z.ZodString>;
    markCompleted: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
export type FinalizeSessionDto = z.infer<typeof FinalizeSessionSchema>;
