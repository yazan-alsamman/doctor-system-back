import { z } from 'zod';
export declare const CopilotRequestSchema: z.ZodObject<{
    input: z.ZodString;
    sessionId: z.ZodOptional<z.ZodString>;
    context: z.ZodOptional<z.ZodObject<{
        patientId: z.ZodOptional<z.ZodString>;
        doctorId: z.ZodOptional<z.ZodString>;
        dateRange: z.ZodOptional<z.ZodObject<{
            from: z.ZodOptional<z.ZodString>;
            to: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type CopilotRequestDto = z.infer<typeof CopilotRequestSchema>;
