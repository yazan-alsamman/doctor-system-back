"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatchPasswordSchema = exports.PatchProfileSchema = void 0;
const zod_1 = require("zod");
exports.PatchProfileSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2).max(120),
});
exports.PatchPasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1),
    newPassword: zod_1.z.string().min(8).max(128),
});
//# sourceMappingURL=account.dto.js.map