import { Prisma } from "@prisma/client";
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogService } from '../common/audit/audit-log.service';
import { DomainEventsService } from '../common/events/domain-events.service';
import { AuthContext } from '../common/auth-context';
import { CreatePatientDto } from './dto/create-patient.dto';
import type { UpdatePatientDto } from './dto/update-patient.dto';
import type { CreatePatientPackageDto } from './dto/create-patient-package.dto';
import { type PatientView } from './patient-format';
export declare class PatientsService {
    private readonly prisma;
    private readonly notifications;
    private readonly auditLog;
    private readonly domainEvents;
    constructor(prisma: PrismaService, notifications: NotificationsService, auditLog: AuditLogService, domainEvents: DomainEventsService);
    private normalizeVitals;
    private mapRecordStatus;
    private toViews;
    list(auth: AuthContext, query?: {
        q?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        items: PatientView[];
        meta: {
            page: number;
            limit: number;
            total: number;
            pages: number;
        };
    }>;
    findOne(auth: AuthContext, id: string): Promise<PatientView>;
    listPackages(auth: AuthContext, patientId: string): Prisma.PrismaPromise<({
        service: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            tenantId: string;
            active: boolean;
            doctorId: string | null;
            price: Prisma.Decimal;
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
        pricePerSession: Prisma.Decimal;
        expiresAt: Date | null;
    })[]>;
    createPackage(auth: AuthContext, patientId: string, dto: CreatePatientPackageDto): Promise<{
        service: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            tenantId: string;
            active: boolean;
            doctorId: string | null;
            price: Prisma.Decimal;
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
        pricePerSession: Prisma.Decimal;
        expiresAt: Date | null;
    }>;
    create(auth: AuthContext, dto: CreatePatientDto): Promise<PatientView>;
    update(auth: AuthContext, id: string, dto: UpdatePatientDto): Promise<PatientView>;
    remove(auth: AuthContext, id: string): Prisma.PrismaPromise<Prisma.BatchPayload>;
    markExpiredPackages(): Promise<number>;
}
