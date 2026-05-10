import { TenantStatus } from "@prisma/client";
import { PrismaService } from '../database/prisma.service';
import type { PatchTenantDto } from './dto/patch-tenant.dto';
import { PlatformAuditService } from './platform-audit.service';
type ListParams = {
    search?: string;
    status?: TenantStatus;
    skip?: number;
    take?: number;
};
export declare class TenantManagementService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: PlatformAuditService);
    private assertClinicTenant;
    list(params: ListParams): Promise<{
        total: number;
        items: {
            id: string;
            name: string;
            status: import("@prisma/client").$Enums.TenantStatus;
            plan: import("@prisma/client").$Enums.Plan;
            subscriptionStatus: import("@prisma/client").$Enums.SubscriptionStatus;
            nextBillingDate: Date | null;
            createdAt: Date;
            updatedAt: Date;
            userCount: number;
            patientCount: number;
            lastActivityAt: Date;
        }[];
    }>;
    private lastActivityByTenant;
    getOne(id: string): Promise<{
        id: string;
        name: string;
        status: import("@prisma/client").$Enums.TenantStatus;
        plan: import("@prisma/client").$Enums.Plan;
        subscriptionStatus: import("@prisma/client").$Enums.SubscriptionStatus;
        nextBillingDate: Date | null;
        createdAt: Date;
        updatedAt: Date;
        userCount: number;
        patientCount: number;
        appointmentCount: number;
        lastActivityAt: Date;
    }>;
    patch(actorUserId: string, id: string, dto: PatchTenantDto): Promise<{
        id: string;
        name: string;
        status: import("@prisma/client").$Enums.TenantStatus;
        plan: import("@prisma/client").$Enums.Plan;
        subscriptionStatus: import("@prisma/client").$Enums.SubscriptionStatus;
        nextBillingDate: Date | null;
        invoiceSeq: number;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
    }>;
    suspend(actorUserId: string, id: string): Promise<{
        ok: boolean;
    }>;
    reactivate(actorUserId: string, id: string): Promise<{
        ok: boolean;
    }>;
    softDelete(actorUserId: string, id: string): Promise<{
        ok: boolean;
    }>;
}
export {};
