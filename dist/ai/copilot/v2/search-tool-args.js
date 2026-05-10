"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeSearchToolArgs = normalizeSearchToolArgs;
exports.paramsToSearchFilters = paramsToSearchFilters;
exports.assertSearchExecutionArgs = assertSearchExecutionArgs;
exports.isSearchToolName = isSearchToolName;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
function normalizeSearchToolArgs(tool, filters) {
    const base = {};
    if (filters.from != null && String(filters.from).trim()) {
        base.from = String(filters.from);
    }
    if (filters.to != null && String(filters.to).trim()) {
        base.to = String(filters.to);
    }
    if (tool === 'searchPatients') {
        const q = filters.q ??
            filters.name ??
            filters.phone ??
            filters.patientName ??
            filters.patient_name ??
            filters.searchQuery;
        if (q != null && String(q).trim())
            base.q = String(q).slice(0, 2000);
        return validateSearchPatientsArgs(base);
    }
    if (tool === 'searchAppointments') {
        const pn = filters.patientName ?? filters.patient_name;
        if (pn != null && String(pn).trim())
            base.patientName = String(pn).slice(0, 500);
        if (filters.doctorId != null && String(filters.doctorId).trim()) {
            const did = String(filters.doctorId);
            if (zod_1.z.string().uuid().safeParse(did).success)
                base.doctorId = did;
        }
        if (filters.status != null && String(filters.status).trim()) {
            base.status = String(filters.status);
        }
        if (typeof filters.isListingQuery === 'boolean') {
            base.isListingQuery = filters.isListingQuery;
        }
        return validateSearchAppointmentsArgs(base);
    }
    const inv = { ...base };
    const pn = filters.patientName ?? filters.patient_name;
    if (pn != null && String(pn).trim())
        inv.patientName = String(pn).slice(0, 500);
    const st = filters.status != null ? String(filters.status).toLowerCase() : '';
    if (st === 'unpaid' || filters.unpaid === true) {
        inv.unpaidOnly = true;
    }
    else if (filters.status != null && String(filters.status).trim()) {
        inv.status = String(filters.status);
    }
    return validateSearchInvoicesArgs(inv);
}
function paramsToSearchFilters(tool, params) {
    switch (tool) {
        case 'searchPatients':
            return {
                q: params.searchQuery,
                from: params.from,
                to: params.to,
            };
        case 'searchAppointments':
            return {
                from: params.from,
                to: params.to,
                patientName: params.patientName,
                doctorId: params.doctorId,
                isListingQuery: params.isListingQuery,
            };
        case 'searchInvoices':
            return {
                from: params.from,
                to: params.to,
                patientName: params.patientName,
            };
        default:
            return {};
    }
}
const SearchPatientsArgsSchema = zod_1.z
    .object({
    q: zod_1.z.string().max(2000).optional(),
    from: zod_1.z.string().max(80).optional(),
    to: zod_1.z.string().max(80).optional(),
})
    .strict();
const SearchAppointmentsArgsSchema = zod_1.z
    .object({
    from: zod_1.z.string().max(80).optional(),
    to: zod_1.z.string().max(80).optional(),
    patientName: zod_1.z.string().max(500).optional(),
    doctorId: zod_1.z.string().uuid().optional(),
    status: zod_1.z.nativeEnum(client_1.AppointmentStatus).optional(),
    isListingQuery: zod_1.z.boolean().optional(),
})
    .strict();
const SearchInvoicesArgsSchema = zod_1.z
    .object({
    from: zod_1.z.string().max(80).optional(),
    to: zod_1.z.string().max(80).optional(),
    patientName: zod_1.z.string().max(500).optional(),
    unpaidOnly: zod_1.z.boolean().optional(),
    status: zod_1.z.nativeEnum(client_1.InvoiceStatus).optional(),
})
    .strict();
function validateSearchPatientsArgs(args) {
    return SearchPatientsArgsSchema.parse(args);
}
function validateSearchAppointmentsArgs(args) {
    const st = args.status;
    if (typeof st === 'string' && st.trim()) {
        if (!(st in client_1.AppointmentStatus)) {
            const { status: _, ...rest } = args;
            return SearchAppointmentsArgsSchema.parse(rest);
        }
    }
    return SearchAppointmentsArgsSchema.parse(args);
}
function validateSearchInvoicesArgs(args) {
    const st = args.status;
    if (typeof st === 'string' && st.trim() && !(st in client_1.InvoiceStatus)) {
        const { status: _, ...rest } = args;
        return SearchInvoicesArgsSchema.parse(rest);
    }
    return SearchInvoicesArgsSchema.parse(args);
}
function assertSearchExecutionArgs(tool, args) {
    return normalizeSearchToolArgs(tool, args);
}
function isSearchToolName(t) {
    return t === 'searchPatients' || t === 'searchAppointments' || t === 'searchInvoices';
}
//# sourceMappingURL=search-tool-args.js.map