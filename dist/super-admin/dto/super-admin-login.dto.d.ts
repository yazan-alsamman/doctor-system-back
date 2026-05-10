import { z } from 'zod';
export declare const SuperAdminLoginSchema: z.ZodObject<{
    email: z.ZodPipe<z.ZodString, z.ZodString>;
    password: z.ZodString;
}, z.core.$strip>;
export type SuperAdminLoginDto = z.infer<typeof SuperAdminLoginSchema>;
