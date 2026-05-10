import { z } from 'zod';
export declare const ALL_TOOL_NAMES: readonly ["getAvailableSlots", "getDoctorSchedule", "detectConflicts", "getPatientHistory", "getPatientSummary", "getInvoiceData", "getRevenueStats", "generateWhatsAppMessage", "searchAppointments", "searchPatients", "searchInvoices"];
export declare const ToolPlanSchema: z.ZodObject<{
    tool: z.ZodEnum<{
        getAvailableSlots: "getAvailableSlots";
        getDoctorSchedule: "getDoctorSchedule";
        detectConflicts: "detectConflicts";
        getPatientHistory: "getPatientHistory";
        getPatientSummary: "getPatientSummary";
        getInvoiceData: "getInvoiceData";
        getRevenueStats: "getRevenueStats";
        generateWhatsAppMessage: "generateWhatsAppMessage";
        searchAppointments: "searchAppointments";
        searchPatients: "searchPatients";
        searchInvoices: "searchInvoices";
    }>;
    args: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    reason: z.ZodString;
}, z.core.$strip>;
export type ValidatedToolPlan = z.infer<typeof ToolPlanSchema>;
