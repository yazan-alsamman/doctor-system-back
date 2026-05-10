import { z } from 'zod';
export declare const PatchProfileSchema: z.ZodObject<{
    name: z.ZodString;
}, z.core.$strip>;
export type PatchProfileDto = z.infer<typeof PatchProfileSchema>;
export declare const PatchPasswordSchema: z.ZodObject<{
    currentPassword: z.ZodString;
    newPassword: z.ZodString;
}, z.core.$strip>;
export type PatchPasswordDto = z.infer<typeof PatchPasswordSchema>;
