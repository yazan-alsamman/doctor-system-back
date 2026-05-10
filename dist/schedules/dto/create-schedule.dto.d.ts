import { z } from 'zod';
export declare const CreateScheduleSchema: z.ZodObject<{
    doctorId: z.ZodString;
    dayOfWeek: z.ZodNumber;
    startTime: z.ZodString;
    endTime: z.ZodString;
    breakStart: z.ZodOptional<z.ZodString>;
    breakEnd: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type CreateScheduleDto = z.infer<typeof CreateScheduleSchema>;
