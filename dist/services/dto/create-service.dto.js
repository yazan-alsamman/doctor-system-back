"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateServiceSchema = void 0;
const zod_1 = require("zod");
exports.CreateServiceSchema = zod_1.z.object({
    id: zod_1.z.string().min(1).optional(),
    doctorId: zod_1.z.string().optional(),
    name: zod_1.z.string().min(2),
    price: zod_1.z.number().positive(),
    durationMinutes: zod_1.z.number().int().positive(),
    category: zod_1.z.string().min(2).optional(),
    aliases: zod_1.z.array(zod_1.z.string()).optional(),
    active: zod_1.z.boolean().optional(),
});
//# sourceMappingURL=create-service.dto.js.map