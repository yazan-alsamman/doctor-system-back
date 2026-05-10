"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdatePatientSchema = void 0;
const zod_1 = require("zod");
const vitalsSchema = zod_1.z.object({
    bp: zod_1.z.string().optional(),
    hr: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).optional(),
    spo2: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).optional(),
});
const medSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    note: zod_1.z.string().optional(),
});
exports.UpdatePatientSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
    phone: zod_1.z.string().min(6).optional(),
    dob: zod_1.z.string().datetime().nullable().optional(),
    notes: zod_1.z.string().max(2000).nullable().optional(),
    sex: zod_1.z.enum(['male', 'female']).optional(),
    bloodType: zod_1.z.string().max(8).optional(),
    status: zod_1.z.enum(['new', 'active', 'inactive']).optional(),
    age: zod_1.z.number().int().min(0).max(130).nullable().optional(),
    allergies: zod_1.z.array(zod_1.z.string()).nullable().optional(),
    medications: zod_1.z.array(medSchema).nullable().optional(),
    vitals: vitalsSchema.nullable().optional(),
});
//# sourceMappingURL=update-patient.dto.js.map