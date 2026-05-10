import { z } from 'zod';
export declare const CreateNextSessionSchema: z.ZodObject<{
    intervalDays: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    repeatCount: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    allowOverbook: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
export type CreateNextSessionDto = z.infer<typeof CreateNextSessionSchema>;
