import { z } from 'zod';
export declare const UpdateAppointmentSchema: z.ZodObject<{
    patientId: z.ZodOptional<z.ZodString>;
    doctorId: z.ZodOptional<z.ZodString>;
    serviceId: z.ZodOptional<z.ZodString>;
    serviceIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    startTime: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
    overbooked: z.ZodOptional<z.ZodBoolean>;
    discount: z.ZodOptional<z.ZodNumber>;
    manualPriceOverride: z.ZodOptional<z.ZodNumber>;
    consentObtained: z.ZodOptional<z.ZodBoolean>;
    treatmentDetails: z.ZodOptional<z.ZodString>;
    doctorRemarks: z.ZodOptional<z.ZodString>;
    specialConditions: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type UpdateAppointmentDto = z.infer<typeof UpdateAppointmentSchema>;
