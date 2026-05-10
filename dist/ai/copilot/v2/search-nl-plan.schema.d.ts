import { z } from 'zod';
export declare const SearchNlPlanSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    tool: z.ZodLiteral<"searchPatients">;
    filters: z.ZodOptional<z.ZodObject<{
        q: z.ZodOptional<z.ZodString>;
        name: z.ZodOptional<z.ZodString>;
        phone: z.ZodOptional<z.ZodString>;
        patientName: z.ZodOptional<z.ZodString>;
        patient_name: z.ZodOptional<z.ZodString>;
        from: z.ZodOptional<z.ZodString>;
        to: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
    display_query: z.ZodOptional<z.ZodString>;
    confidence: z.ZodOptional<z.ZodUnion<readonly [z.ZodEnum<{
        high: "high";
        medium: "medium";
        low: "low";
    }>, z.ZodString]>>;
}, z.core.$strip>, z.ZodObject<{
    tool: z.ZodLiteral<"searchAppointments">;
    filters: z.ZodOptional<z.ZodObject<{
        patientName: z.ZodOptional<z.ZodString>;
        patient_name: z.ZodOptional<z.ZodString>;
        doctorId: z.ZodOptional<z.ZodString>;
        from: z.ZodOptional<z.ZodString>;
        to: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodString>;
        isListingQuery: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strict>>;
    display_query: z.ZodOptional<z.ZodString>;
    confidence: z.ZodOptional<z.ZodUnion<readonly [z.ZodEnum<{
        high: "high";
        medium: "medium";
        low: "low";
    }>, z.ZodString]>>;
}, z.core.$strip>, z.ZodObject<{
    tool: z.ZodLiteral<"searchInvoices">;
    filters: z.ZodOptional<z.ZodObject<{
        patientName: z.ZodOptional<z.ZodString>;
        patient_name: z.ZodOptional<z.ZodString>;
        from: z.ZodOptional<z.ZodString>;
        to: z.ZodOptional<z.ZodString>;
        unpaid: z.ZodOptional<z.ZodBoolean>;
        status: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
    display_query: z.ZodOptional<z.ZodString>;
    confidence: z.ZodOptional<z.ZodUnion<readonly [z.ZodEnum<{
        high: "high";
        medium: "medium";
        low: "low";
    }>, z.ZodString]>>;
}, z.core.$strip>], "tool">;
export type ParsedNlSearchPlan = z.infer<typeof SearchNlPlanSchema>;
export type StructuredSearchPlan = ParsedNlSearchPlan;
export declare function safeParseNlSearchPlan(data: unknown): ReturnType<typeof SearchNlPlanSchema.safeParse>;
