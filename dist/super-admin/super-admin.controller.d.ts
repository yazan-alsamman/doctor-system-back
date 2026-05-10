import { TenantStatus } from "@prisma/client";
import type { AuthContext } from '../common/auth-context';
import { TenantManagementService } from './tenant-management.service';
import { TenantProvisionService } from './tenant-provision.service';
import { PlatformMetricsService } from './platform-metrics.service';
import { PlatformHealthService } from './platform-health.service';
import { PlatformAuditService } from './platform-audit.service';
import { type CreateClinicDto } from './dto/create-clinic.dto';
import { type PatchTenantDto } from './dto/patch-tenant.dto';
export declare class SuperAdminController {
    private readonly tenants;
    private readonly provision;
    private readonly metrics;
    private readonly health;
    private readonly audit;
    constructor(tenants: TenantManagementService, provision: TenantProvisionService, metrics: PlatformMetricsService, health: PlatformHealthService, audit: PlatformAuditService);
    metricsOverview(): Promise<{
        totalClinics: number;
        activeClinics: number;
        suspendedClinics: number;
        trialClinics: number;
        totalUsers: number;
        totalPatients: number;
        appointmentsToday: number;
        activitySeries: {
            date: string;
            count: number;
        }[];
        clinicsByStatus: {
            name: string;
            value: number;
        }[];
    }>;
    healthSnapshot(): Promise<{
        api: {
            status: "up";
        };
        database: {
            status: "up" | "down";
        };
        lastBackupAt: string;
        errorLogCount: number;
    }>;
    auditLogs(action?: string, targetTenantId?: string, skip?: string, take?: string): Promise<{
        total: number;
        items: {
            id: string;
            action: string;
            targetTenantId: string | null;
            metadata: import("@prisma/client/runtime/client").JsonValue;
            createdAt: Date;
            actor: {
                id: string;
                name: string;
                email: string;
                role: import("@prisma/client").$Enums.UserRole;
            } | null;
        }[];
    }>;
    listTenants(search?: string, status?: TenantStatus, skip?: string, take?: string): Promise<{
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
    getTenant(id: string): Promise<{
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
    createTenant(auth: AuthContext, body: CreateClinicDto): Promise<{
        tenantId: string;
        tenantName: string;
        plan: import("@prisma/client").$Enums.Plan;
        status: import("@prisma/client").$Enums.TenantStatus;
        adminEmail: string;
        message: string;
    }>;
    patchTenant(auth: AuthContext, id: string, body: PatchTenantDto): Promise<{
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
    suspendTenant(auth: AuthContext, id: string): Promise<{
        ok: boolean;
    }>;
    reactivateTenant(auth: AuthContext, id: string): Promise<{
        ok: boolean;
    }>;
    softDeleteTenant(auth: AuthContext, id: string): Promise<{
        ok: boolean;
    }>;
}
