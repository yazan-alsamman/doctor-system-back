"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayInvoiceSchema = void 0;
const zod_1 = require("zod");
exports.PayInvoiceSchema = zod_1.z.object({
    paidAmount: zod_1.z.number().positive().optional(),
    method: zod_1.z.enum(['cash', 'card', 'transfer', 'other']).optional(),
    reference: zod_1.z.string().max(120).optional(),
    idempotencyKey: zod_1.z.string().max(128).optional(),
});
//# sourceMappingURL=pay-invoice.dto.js.map