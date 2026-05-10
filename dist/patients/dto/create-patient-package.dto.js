"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreatePatientPackageSchema = void 0;
const zod_1 = require("zod");
exports.CreatePatientPackageSchema = zod_1.z.object({
    serviceId: zod_1.z.string().min(1),
    totalSessions: zod_1.z.number().int().min(1).max(60),
    expiresAt: zod_1.z.string().datetime().optional(),
});
//# sourceMappingURL=create-patient-package.dto.js.map