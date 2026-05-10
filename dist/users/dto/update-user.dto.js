"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateUserSchema = void 0;
const zod_1 = require("zod");
const clinicUserRole = zod_1.z.enum(['admin', 'doctor', 'receptionist']);
exports.UpdateUserSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
    title: zod_1.z.string().min(2).optional(),
    email: zod_1.z.string().email().optional(),
    role: clinicUserRole.optional(),
    doctorCode: zod_1.z.string().min(1).nullable().optional(),
    active: zod_1.z.boolean().optional(),
    access: zod_1.z.any().nullable().optional(),
});
//# sourceMappingURL=update-user.dto.js.map