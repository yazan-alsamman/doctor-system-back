"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatchAppointmentPayloadSchema = exports.CreatePatientPayloadSchema = exports.PatchPatientPayloadSchema = exports.SyncBatchSchema = exports.SyncBatchOpSchema = void 0;
const zod_1 = require("zod");
const create_patient_dto_1 = require("../../patients/dto/create-patient.dto");
const update_patient_dto_1 = require("../../patients/dto/update-patient.dto");
const update_appointment_dto_1 = require("../../appointments/dto/update-appointment.dto");
exports.SyncBatchOpSchema = zod_1.z.object({
    idempotencyKey: zod_1.z.string().uuid(),
    operation: zod_1.z.enum([
        'PATCH_PATIENT',
        'CREATE_PATIENT',
        'PATCH_APPOINTMENT',
        'RECORD_PAYMENT',
        'RECORD_REFUND',
    ]),
    payload: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
});
exports.SyncBatchSchema = zod_1.z.object({
    ops: zod_1.z.array(exports.SyncBatchOpSchema).min(1).max(50),
});
exports.PatchPatientPayloadSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    patch: update_patient_dto_1.UpdatePatientSchema,
});
exports.CreatePatientPayloadSchema = create_patient_dto_1.CreatePatientSchema;
exports.PatchAppointmentPayloadSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    patch: update_appointment_dto_1.UpdateAppointmentSchema,
});
//# sourceMappingURL=sync-batch.dto.js.map