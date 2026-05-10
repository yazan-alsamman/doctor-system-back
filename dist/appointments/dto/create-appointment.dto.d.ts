import { z } from 'zod';
export declare const CreateAppointmentSchema: z.ZodObject<{
    patientId: z.ZodString;
    doctorId: z.ZodString;
    serviceId: z.ZodString;
    serviceIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    startTime: z.ZodString;
    allowOverbook: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    notes: z.ZodOptional<z.ZodString>;
    discount: z.ZodOptional<z.ZodNumber>;
    manualPriceOverride: z.ZodOptional<z.ZodNumber>;
    consentObtained: z.ZodOptional<z.ZodBoolean>;
    treatmentDetails: z.ZodOptional<z.ZodString>;
    doctorRemarks: z.ZodOptional<z.ZodString>;
    specialConditions: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type CreateAppointmentDto = z.infer<typeof CreateAppointmentSchema>;
