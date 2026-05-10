import { z } from 'zod';
export declare const AddAppointmentMediaSchema: z.ZodObject<{
    label: z.ZodEnum<{
        before: "before";
        after: "after";
    }>;
    imageUrl: z.ZodString;
}, z.core.$strip>;
export type AddAppointmentMediaDto = z.infer<typeof AddAppointmentMediaSchema>;
