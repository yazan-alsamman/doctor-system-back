"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreatePatientSchema = void 0;
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
exports.CreatePatientSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    phone: zod_1.z.string().min(6),
    dob: zod_1.z.string().datetime().nullable().optional(),
    notes: zod_1.z.string().max(2000).nullable().optional(),
    sex: zod_1.z.enum(['male', 'female']).optional(),
    bloodType: zod_1.z.string().max(8).nullable().optional(),
    status: zod_1.z.enum(['new', 'active', 'inactive']).optional(),
    age: zod_1.z.union([zod_1.z.number().int().min(0).max(130), zod_1.z.null()]).optional(),
    allergies: zod_1.z.array(zod_1.z.string()).nullable().optional(),
    medications: zod_1.z.array(medSchema).nullable().optional(),
    vitals: vitalsSchema.nullable().optional(),
    quickRegistration: zod_1.z.boolean().optional(),
});
//# sourceMappingURL=create-patient.dto.js.map