import { z } from 'zod';
export declare const UpdateAppointmentStatusSchema: z.ZodObject<{
    status: z.ZodEnum<{
        scheduled: "scheduled";
        confirmed: "confirmed";
        arrived: "arrived";
        in_consultation: "in_consultation";
        completed: "completed";
        paid: "paid";
        no_show: "no_show";
        cancelled: "cancelled";
    }>;
    reason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type UpdateAppointmentStatusDto = z.infer<typeof UpdateAppointmentStatusSchema>;
