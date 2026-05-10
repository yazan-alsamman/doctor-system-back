import { z } from 'zod';
export declare const CreateUserSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
    email: z.ZodString;
    password: z.ZodString;
    role: z.ZodEnum<{
        admin: "admin";
        doctor: "doctor";
        receptionist: "receptionist";
    }>;
    doctorCode: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type CreateUserDto = z.infer<typeof CreateUserSchema>;
