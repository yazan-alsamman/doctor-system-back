import { AppointmentStatus, type Patient } from "@prisma/client";
export type PatientMedicationRow = {
    name: string;
    note?: string;
};
export type PatientVitals = {
    bp: string;
    hr: number;
    spo2: number;
};
export type PatientView = {
    id: string;
    tenantId: string;
    name: string;
    phone: string;
    notes: string | null;
    dob: string | null;
    sex: 'male' | 'female';
    sexLabel: string;
    bloodType: string;
    status: 'new' | 'active' | 'inactive';
    age: number;
    allergies: string[];
    meds: PatientMedicationRow[];
    vitals: PatientVitals;
    lastVisit: string;
    nextAppointment: string;
    createdAt: string;
    updatedAt: string;
};
export declare function computeAgeYears(dob: Date | null, ageYears: number | null, now?: Date): number;
type ApptRow = {
    patientId: string;
    startTime: Date;
    status: AppointmentStatus;
};
export declare function buildScheduleForPatients(patientIds: string[], appts: ApptRow[], now: Date): Map<string, {
    last: Date | null;
    next: Date | null;
}>;
export declare function toPatientView(p: Patient, schedule: {
    last: Date | null;
    next: Date | null;
}, now: Date): PatientView;
export {};
