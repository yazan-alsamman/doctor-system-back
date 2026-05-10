import { z } from 'zod';
export declare const SyncBatchOpSchema: z.ZodObject<{
    idempotencyKey: z.ZodString;
    operation: z.ZodEnum<{
        PATCH_PATIENT: "PATCH_PATIENT";
        CREATE_PATIENT: "CREATE_PATIENT";
        PATCH_APPOINTMENT: "PATCH_APPOINTMENT";
        RECORD_PAYMENT: "RECORD_PAYMENT";
        RECORD_REFUND: "RECORD_REFUND";
    }>;
    payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, z.core.$strip>;
export declare const SyncBatchSchema: z.ZodObject<{
    ops: z.ZodArray<z.ZodObject<{
        idempotencyKey: z.ZodString;
        operation: z.ZodEnum<{
            PATCH_PATIENT: "PATCH_PATIENT";
            CREATE_PATIENT: "CREATE_PATIENT";
            PATCH_APPOINTMENT: "PATCH_APPOINTMENT";
            RECORD_PAYMENT: "RECORD_PAYMENT";
            RECORD_REFUND: "RECORD_REFUND";
        }>;
        payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type SyncBatchDto = z.infer<typeof SyncBatchSchema>;
export declare const PatchPatientPayloadSchema: z.ZodObject<{
    id: z.ZodString;
    patch: z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        phone: z.ZodOptional<z.ZodString>;
        dob: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        sex: z.ZodOptional<z.ZodEnum<{
            male: "male";
            female: "female";
        }>>;
        bloodType: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodEnum<{
            active: "active";
            new: "new";
            inactive: "inactive";
        }>>;
        age: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
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
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const CreatePatientPayloadSchema: z.ZodObject<{
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
export declare const PatchAppointmentPayloadSchema: z.ZodObject<{
    id: z.ZodString;
    patch: z.ZodObject<{
        patientId: z.ZodOptional<z.ZodString>;
        doctorId: z.ZodOptional<z.ZodString>;
        serviceId: z.ZodOptional<z.ZodString>;
        serviceIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
        startTime: z.ZodOptional<z.ZodString>;
        notes: z.ZodOptional<z.ZodString>;
        overbooked: z.ZodOptional<z.ZodBoolean>;
        discount: z.ZodOptional<z.ZodNumber>;
        manualPriceOverride: z.ZodOptional<z.ZodNumber>;
        consentObtained: z.ZodOptional<z.ZodBoolean>;
        treatmentDetails: z.ZodOptional<z.ZodString>;
        doctorRemarks: z.ZodOptional<z.ZodString>;
        specialConditions: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type SyncBatchOpDto = z.infer<typeof SyncBatchOpSchema>;
