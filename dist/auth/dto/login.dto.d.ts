import { z } from 'zod';
export declare const LoginSchema: z.ZodObject<{
    email: z.ZodPipe<z.ZodString, z.ZodString>;
    password: z.ZodString;
    tenantId: z.ZodPreprocess<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export type LoginDto = z.infer<typeof LoginSchema>;
