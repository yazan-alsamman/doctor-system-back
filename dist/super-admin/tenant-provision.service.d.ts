import { PrismaService } from '../database/prisma.service';
import type { CreateClinicDto } from './dto/create-clinic.dto';
import { PlatformAuditService } from './platform-audit.service';
export declare class TenantProvisionService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: PlatformAuditService);
    provision(actorUserId: string, dto: CreateClinicDto): Promise<{
        tenantId: string;
        tenantName: string;
        plan: import("@prisma/client").$Enums.Plan;
        status: import("@prisma/client").$Enums.TenantStatus;
        adminEmail: string;
        message: string;
    }>;
}
