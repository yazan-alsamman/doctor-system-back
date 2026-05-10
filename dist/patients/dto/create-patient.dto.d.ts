import { z } from 'zod';
export declare const CreatePatientSchema: z.ZodObject<{
    name: z.ZodString;
    phone: z.ZodString;
    dob: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    sex: z.ZodOptional<z.ZodEnum<{
        male: "male";
        female: "female";
    }>>;
    bloodType: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodOptional<z.ZodEnum<{
        active: "active";
        new: "new";
        inactive: "inactive";
    }>>;
    age: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodNull]>>;
    allergies: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
    medications: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        note: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>>;
    vitals: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        bp: z.ZodOptional<z.ZodString>;
        hr: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
        spo2: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
    }, z.core.$strip>>>;
    quickRegistration: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type CreatePatientDto = z.infer<typeof CreatePatientSchema>;
