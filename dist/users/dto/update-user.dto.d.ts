import { z } from 'zod';
export declare const UpdateUserSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    title: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodEnum<{
        admin: "admin";
        doctor: "doctor";
        receptionist: "receptionist";
    }>>;
    doctorCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    active: z.ZodOptional<z.ZodBoolean>;
    access: z.ZodOptional<z.ZodNullable<z.ZodAny>>;
}, z.core.$strip>;
export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;
