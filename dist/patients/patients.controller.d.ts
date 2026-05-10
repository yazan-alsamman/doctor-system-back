import { PatientsService } from './patients.service';
import { AccessService } from '../common/access/access.service';
import type { AuthContext } from '../common/auth-context';
import type { CreatePatientDto } from './dto/create-patient.dto';
import type { UpdatePatientDto } from './dto/update-patient.dto';
import type { CreatePatientPackageDto } from './dto/create-patient-package.dto';
export declare class PatientsController {
    private readonly patientsService;
    private readonly access;
    constructor(patientsService: PatientsService, access: AccessService);
    list(auth: AuthContext, q?: string, page?: string, limit?: string): Promise<{
        items: import("./patient-format").PatientView[];
        meta: {
            page: number;
            limit: number;
            total: number;
            pages: number;
        };
    }>;
    create(auth: AuthContext, body: CreatePatientDto): Promise<import("./patient-format").PatientView>;
    listPackages(auth: AuthContext, id: string): import("@prisma/client").Prisma.PrismaPromise<({
        service: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            tenantId: string;
            active: boolean;
            doctorId: string | null;
            price: import("@prisma/client-runtime-utils").Decimal;
            durationMinutes: number;
            category: string;
            aliases: string[];
        };
    } & {
        id: string;
        status: import("@prisma/client").$Enums.PackageStatus;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        tenantId: string;
        patientId: string;
        serviceId: string;
        totalSessions: number;
        remainingSessions: number;
        pricePerSession: import("@prisma/client-runtime-utils").Decimal;
        expiresAt: Date | null;
    })[]>;
    createPackage(auth: AuthContext, id: string, body: CreatePatientPackageDto): Promise<{
        service: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            tenantId: string;
            active: boolean;
            doctorId: string | null;
            price: import("@prisma/client-runtime-utils").Decimal;
            durationMinutes: number;
            category: string;
            aliases: string[];
        };
    } & {
        id: string;
        status: import("@prisma/client").$Enums.PackageStatus;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        tenantId: string;
        patientId: string;
        serviceId: string;
        totalSessions: number;
        remainingSessions: number;
        pricePerSession: import("@prisma/client-runtime-utils").Decimal;
        expiresAt: Date | null;
    }>;
    findOne(auth: AuthContext, id: string): Promise<import("./patient-format").PatientView>;
    update(auth: AuthContext, id: string, body: UpdatePatientDto): Promise<import("./patient-format").PatientView>;
    remove(auth: AuthContext, id: string): import("@prisma/client").Prisma.PrismaPromise<import("@prisma/client").Prisma.BatchPayload>;
}
