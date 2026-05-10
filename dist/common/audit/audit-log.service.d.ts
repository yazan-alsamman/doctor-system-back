import { Prisma, PrismaClient } from "@prisma/client";
export declare class AuditLogService {
    logTx(tx: Prisma.TransactionClient, input: {
        tenantId: string;
        actorUserId?: string | null;
        action: string;
        entityType: string;
        entityId: string;
        metadata?: Prisma.InputJsonValue;
    }): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        actorUserId: string | null;
        action: string;
        entityType: string;
        entityId: string;
        metadata: Prisma.JsonValue | null;
    }>;
    log(prisma: PrismaClient, input: {
        tenantId: string;
        actorUserId?: string | null;
        action: string;
        entityType: string;
        entityId: string;
        metadata?: Prisma.InputJsonValue;
    }): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        actorUserId: string | null;
        action: string;
        entityType: string;
        entityId: string;
        metadata: Prisma.JsonValue | null;
    }>;
}
