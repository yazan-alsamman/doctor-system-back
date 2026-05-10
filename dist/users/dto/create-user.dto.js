"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateUserSchema = void 0;
const zod_1 = require("zod");
const clinicUserRole = zod_1.z.enum(['admin', 'doctor', 'receptionist']);
exports.CreateUserSchema = zod_1.z.object({
    id: zod_1.z.string().min(1).optional(),
    name: zod_1.z.string().min(2),
    title: zod_1.z.string().min(2).optional(),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    role: clinicUserRole,
    doctorCode: zod_1.z.string().min(1).optional(),
});
//# sourceMappingURL=create-user.dto.js.map