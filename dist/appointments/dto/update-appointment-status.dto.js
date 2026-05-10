"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateAppointmentStatusSchema = void 0;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
exports.UpdateAppointmentStatusSchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(client_1.AppointmentStatus),
    reason: zod_1.z.string().max(500).optional(),
});
//# sourceMappingURL=update-appointment-status.dto.js.map