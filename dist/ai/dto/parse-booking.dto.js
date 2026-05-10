"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParseBookingSchema = void 0;
const zod_1 = require("zod");
exports.ParseBookingSchema = zod_1.z.object({
    text: zod_1.z.string().min(1).max(8000),
    referenceDateIso: zod_1.z.string().min(8).max(64).optional(),
    doctors: zod_1.z
        .array(zod_1.z.object({
        id: zod_1.z.string().min(1),
        name: zod_1.z.string().min(1),
        dept: zod_1.z.string().optional(),
    }))
        .min(1),
    patients: zod_1.z
        .array(zod_1.z.object({
        name: zod_1.z.string().min(1),
    }))
        .optional(),
});
//# sourceMappingURL=parse-booking.dto.js.map