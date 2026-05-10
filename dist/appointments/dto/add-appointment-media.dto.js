"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddAppointmentMediaSchema = void 0;
const zod_1 = require("zod");
exports.AddAppointmentMediaSchema = zod_1.z.object({
    label: zod_1.z.enum(['before', 'after']),
    imageUrl: zod_1.z
        .string()
        .url()
        .refine((u) => /^https?:\/\//i.test(u), {
        message: 'imageUrl must use https:// or http://',
    }),
});
//# sourceMappingURL=add-appointment-media.dto.js.map