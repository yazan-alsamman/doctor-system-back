"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateAppointmentSchema = void 0;
const zod_1 = require("zod");
exports.UpdateAppointmentSchema = zod_1.z.object({
    patientId: zod_1.z.string().min(1).optional(),
    doctorId: zod_1.z.string().min(1).optional(),
    serviceId: zod_1.z.string().min(1).optional(),
    serviceIds: zod_1.z.array(zod_1.z.string().min(1)).min(1).optional(),
    startTime: zod_1.z.string().datetime().optional(),
    notes: zod_1.z.string().max(2000).optional(),
    overbooked: zod_1.z.boolean().optional(),
    discount: zod_1.z.number().nonnegative().optional(),
    manualPriceOverride: zod_1.z.number().nonnegative().optional(),
    consentObtained: zod_1.z.boolean().optional(),
    treatmentDetails: zod_1.z.string().max(4000).optional(),
    doctorRemarks: zod_1.z.string().max(4000).optional(),
    specialConditions: zod_1.z.string().max(4000).optional(),
});
//# sourceMappingURL=update-appointment.dto.js.map