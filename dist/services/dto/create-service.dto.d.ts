import { z } from 'zod';
export declare const CreateServiceSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    doctorId: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    price: z.ZodNumber;
    durationMinutes: z.ZodNumber;
    category: z.ZodOptional<z.ZodString>;
    aliases: z.ZodOptional<z.ZodArray<z.ZodString>>;
    active: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type CreateServiceDto = z.infer<typeof CreateServiceSchema>;
