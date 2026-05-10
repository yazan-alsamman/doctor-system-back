"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateServiceSchema = void 0;
const zod_1 = require("zod");
exports.UpdateServiceSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
    price: zod_1.z.number().positive().optional(),
    durationMinutes: zod_1.z.number().int().positive().optional(),
    category: zod_1.z.string().min(2).optional(),
    aliases: zod_1.z.array(zod_1.z.string()).optional(),
    active: zod_1.z.boolean().optional(),
    doctorId: zod_1.z.string().nullable().optional(),
});
//# sourceMappingURL=update-service.dto.js.map