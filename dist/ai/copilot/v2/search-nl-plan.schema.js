"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchNlPlanSchema = void 0;
exports.safeParseNlSearchPlan = safeParseNlSearchPlan;
const zod_1 = require("zod");
const SearchFiltersPatients = zod_1.z
    .object({
    q: zod_1.z.string().max(2000).optional(),
    name: zod_1.z.string().max(500).optional(),
    phone: zod_1.z.string().max(120).optional(),
    patientName: zod_1.z.string().max(500).optional(),
    patient_name: zod_1.z.string().max(500).optional(),
    from: zod_1.z.string().max(80).optional(),
    to: zod_1.z.string().max(80).optional(),
})
    .strict();
const SearchFiltersAppointments = zod_1.z
    .object({
    patientName: zod_1.z.string().max(500).optional(),
    patient_name: zod_1.z.string().max(500).optional(),
    doctorId: zod_1.z.string().uuid().optional(),
    from: zod_1.z.string().max(80).optional(),
    to: zod_1.z.string().max(80).optional(),
    status: zod_1.z.string().max(40).optional(),
    isListingQuery: zod_1.z.boolean().optional(),
})
    .strict();
const SearchFiltersInvoices = zod_1.z
    .object({
    patientName: zod_1.z.string().max(500).optional(),
    patient_name: zod_1.z.string().max(500).optional(),
    from: zod_1.z.string().max(80).optional(),
    to: zod_1.z.string().max(80).optional(),
    unpaid: zod_1.z.boolean().optional(),
    status: zod_1.z.string().max(40).optional(),
})
    .strict();
exports.SearchNlPlanSchema = zod_1.z.discriminatedUnion('tool', [
    zod_1.z.object({
        tool: zod_1.z.literal('searchPatients'),
        filters: SearchFiltersPatients.optional(),
        display_query: zod_1.z.string().max(4000).optional(),
        confidence: zod_1.z.union([zod_1.z.enum(['high', 'medium', 'low']), zod_1.z.string().max(32)]).optional(),
    }),
    zod_1.z.object({
        tool: zod_1.z.literal('searchAppointments'),
        filters: SearchFiltersAppointments.optional(),
        display_query: zod_1.z.string().max(4000).optional(),
        confidence: zod_1.z.union([zod_1.z.enum(['high', 'medium', 'low']), zod_1.z.string().max(32)]).optional(),
    }),
    zod_1.z.object({
        tool: zod_1.z.literal('searchInvoices'),
        filters: SearchFiltersInvoices.optional(),
        display_query: zod_1.z.string().max(4000).optional(),
        confidence: zod_1.z.union([zod_1.z.enum(['high', 'medium', 'low']), zod_1.z.string().max(32)]).optional(),
    }),
]);
function safeParseNlSearchPlan(data) {
    return exports.SearchNlPlanSchema.safeParse(data);
}
//# sourceMappingURL=search-nl-plan.schema.js.map