"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateClinicSchema = void 0;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
exports.CreateClinicSchema = zod_1.z.object({
    clinicName: zod_1.z.string().min(2).max(160),
    adminName: zod_1.z.string().min(2).max(160),
    adminEmail: zod_1.z.string().trim().toLowerCase().pipe(zod_1.z.string().email()),
    adminPassword: zod_1.z.string().min(8),
    plan: zod_1.z.nativeEnum(client_1.Plan),
});
//# sourceMappingURL=create-clinic.dto.js.map