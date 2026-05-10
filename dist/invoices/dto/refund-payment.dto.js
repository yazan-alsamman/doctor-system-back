"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefundPaymentSchema = void 0;
const zod_1 = require("zod");
exports.RefundPaymentSchema = zod_1.z.object({
    amount: zod_1.z.union([zod_1.z.number().positive(), zod_1.z.string()]),
    reason: zod_1.z.string().max(2000).optional(),
});
//# sourceMappingURL=refund-payment.dto.js.map