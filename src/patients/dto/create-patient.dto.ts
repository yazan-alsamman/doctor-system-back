import { z } from 'zod';

const vitalsSchema = z.object({
  bp: z.string().optional(),
  hr: z.union([z.number(), z.string()]).optional(),
  spo2: z.union([z.number(), z.string()]).optional(),
});

const medSchema = z.object({
  name: z.string().min(1),
  note: z.string().optional(),
});

export const CreatePatientSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(6),
  dob: z.string().datetime().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  sex: z.enum(['male', 'female']).optional(),
  bloodType: z.string().max(8).nullable().optional(),
  status: z.enum(['new', 'active', 'inactive']).optional(),
  /** غائب أو null للتسجيل السريع — يُكمَل لاحقاً */
  age: z.union([z.number().int().min(0).max(130), z.null()]).optional(),
  allergies: z.array(z.string()).nullable().optional(),
  medications: z.array(medSchema).nullable().optional(),
  vitals: vitalsSchema.nullable().optional(),
  /** من الحجز السريع — يُنشئ إشعاراً لإكمال الملف */
  quickRegistration: z.boolean().optional(),
});

export type CreatePatientDto = z.infer<typeof CreatePatientSchema>;
