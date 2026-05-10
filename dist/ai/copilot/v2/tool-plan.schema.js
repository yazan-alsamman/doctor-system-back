"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolPlanSchema = exports.ALL_TOOL_NAMES = void 0;
const zod_1 = require("zod");
exports.ALL_TOOL_NAMES = [
    'getAvailableSlots',
    'getDoctorSchedule',
    'detectConflicts',
    'getPatientHistory',
    'getPatientSummary',
    'getInvoiceData',
    'getRevenueStats',
    'generateWhatsAppMessage',
    'searchAppointments',
    'searchPatients',
    'searchInvoices',
];
const MAX_ARG_KEYS = 40;
const MAX_STRING_LEN = 8000;
function depthOf(obj, d = 0) {
    if (d > 8)
        return 9;
    if (obj === null || typeof obj !== 'object')
        return d;
    if (Array.isArray(obj)) {
        let m = d;
        for (const x of obj.slice(0, 50))
            m = Math.max(m, depthOf(x, d + 1));
        return m;
    }
    const o = obj;
    let m = d;
    for (const k of Object.keys(o).slice(0, MAX_ARG_KEYS)) {
        m = Math.max(m, depthOf(o[k], d + 1));
    }
    return m;
}
exports.ToolPlanSchema = zod_1.z.object({
    tool: zod_1.z.enum(exports.ALL_TOOL_NAMES),
    args: zod_1.z
        .record(zod_1.z.string(), zod_1.z.unknown())
        .superRefine((args, ctx) => {
        const keys = Object.keys(args);
        if (keys.length > MAX_ARG_KEYS) {
            ctx.addIssue({ code: 'custom', message: 'too_many_arg_keys' });
        }
        if (depthOf(args) > 7) {
            ctx.addIssue({ code: 'custom', message: 'args_too_deep' });
        }
        for (const [k, v] of Object.entries(args)) {
            if (['__proto__', 'constructor', 'prototype'].includes(k)) {
                ctx.addIssue({ code: 'custom', message: `forbidden_key:${k}` });
            }
            if (typeof v === 'string' && v.length > MAX_STRING_LEN) {
                ctx.addIssue({ code: 'custom', message: `string_too_long:${k}` });
            }
        }
    }),
    reason: zod_1.z.string().max(2000),
});
//# sourceMappingURL=tool-plan.schema.js.map