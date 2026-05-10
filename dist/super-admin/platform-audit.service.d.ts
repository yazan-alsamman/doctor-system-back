import type { Prisma } from "@prisma/client";
import { PrismaService } from '../database/prisma.service';
export declare class PlatformAuditService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    log(action: string, actorUserId: string | null, targetTenantId: string | null, metadata?: Prisma.InputJsonValue): Promise<{
        id: string;
        createdAt: Date;
        actorUserId: string | null;
        action: string;
        metadata: Prisma.JsonValue | null;
        targetTenantId: string | null;
    }>;
    list(params: {
        action?: string;
        targetTenantId?: string;
        skip?: number;
        take?: number;
    }): Promise<{
        total: number;
        items: {
            id: string;
            action: string;
            targetTenantId: string | null;
            metadata: Prisma.JsonValue;
            createdAt: Date;
            actor: {
                id: string;
                name: string;
                email: string;
                role: import("@prisma/client").$Enums.UserRole;
            } | null;
        }[];
    }>;
}
