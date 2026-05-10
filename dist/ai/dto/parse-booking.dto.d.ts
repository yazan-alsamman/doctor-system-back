import { z } from 'zod';
export declare const ParseBookingSchema: z.ZodObject<{
    text: z.ZodString;
    referenceDateIso: z.ZodOptional<z.ZodString>;
    doctors: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        dept: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    patients: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type ParseBookingDto = z.infer<typeof ParseBookingSchema>;
