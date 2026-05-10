"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuperAdminLoginSchema = void 0;
const zod_1 = require("zod");
exports.SuperAdminLoginSchema = zod_1.z.object({
    email: zod_1.z.string().trim().toLowerCase().pipe(zod_1.z.string().email()),
    password: zod_1.z.string().min(6),
});
//# sourceMappingURL=super-admin-login.dto.js.map