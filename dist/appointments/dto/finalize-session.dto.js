"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinalizeSessionSchema = void 0;
const zod_1 = require("zod");
exports.FinalizeSessionSchema = zod_1.z.object({
    serviceIds: zod_1.z.array(zod_1.z.string().min(1)).min(1).optional(),
    discount: zod_1.z.number().nonnegative().optional(),
    manualPriceOverride: zod_1.z.number().nonnegative().optional(),
    consentObtained: zod_1.z.boolean().optional(),
    treatmentDetails: zod_1.z.string().max(4000).optional(),
    doctorRemarks: zod_1.z.string().max(4000).optional(),
    specialConditions: zod_1.z.string().max(4000).optional(),
    markCompleted: zod_1.z.boolean().optional().default(true),
});
//# sourceMappingURL=finalize-session.dto.js.map