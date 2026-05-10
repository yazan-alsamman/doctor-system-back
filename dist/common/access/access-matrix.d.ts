import { UserRole } from "@prisma/client";
import { Prisma } from "@prisma/client";
export type ClinicAccess = {
    dashboard: boolean;
    appointments: {
        view: boolean;
        create: boolean;
        edit: boolean;
    };
    patients: {
        view: boolean;
        create: boolean;
        edit: boolean;
        notes: boolean;
    };
    billing: boolean | {
        view: boolean;
        create: boolean;
        reports: boolean;
    };
    inventory: boolean;
    reports: boolean;
    settings: boolean;
    procedures: {
        view: boolean;
        manage: boolean;
    };
    users: {
        manage: boolean;
    };
    aiBooking: boolean;
};
export declare function defaultAccessForRole(role: UserRole): ClinicAccess;
export declare function mergeFeatureOverrides(role: UserRole, overrides: unknown): ClinicAccess;
export declare function diffPartialAccess(role: UserRole, desired: ClinicAccess): Prisma.InputJsonValue | null;
export declare function getAccessPath(access: ClinicAccess, dotPath: string): boolean;
