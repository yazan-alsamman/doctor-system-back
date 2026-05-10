"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateAppointmentSchema = void 0;
const zod_1 = require("zod");
exports.CreateAppointmentSchema = zod_1.z.object({
    patientId: zod_1.z.string().min(1),
    doctorId: zod_1.z.string().min(1),
    serviceId: zod_1.z.string().min(1),
    serviceIds: zod_1.z.array(zod_1.z.string().min(1)).min(1).optional(),
    startTime: zod_1.z.string().datetime(),
    allowOverbook: zod_1.z.boolean().optional().default(false),
    notes: zod_1.z.string().max(2000).optional(),
    discount: zod_1.z.number().nonnegative().optional(),
    manualPriceOverride: zod_1.z.number().nonnegative().optional(),
    consentObtained: zod_1.z.boolean().optional(),
    treatmentDetails: zod_1.z.string().max(4000).optional(),
    doctorRemarks: zod_1.z.string().max(4000).optional(),
    specialConditions: zod_1.z.string().max(4000).optional(),
});
//# sourceMappingURL=create-appointment.dto.js.map