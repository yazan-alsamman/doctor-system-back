"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateNextSessionSchema = void 0;
const zod_1 = require("zod");
exports.CreateNextSessionSchema = zod_1.z.object({
    intervalDays: zod_1.z.number().int().min(1).max(90).optional().default(14),
    repeatCount: zod_1.z.number().int().min(1).max(6).optional().default(1),
    allowOverbook: zod_1.z.boolean().optional().default(false),
});
//# sourceMappingURL=create-next-session.dto.js.map