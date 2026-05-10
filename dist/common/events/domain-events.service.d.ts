import { Prisma, PrismaClient } from "@prisma/client";
export declare class DomainEventsService {
    emitTx(tx: Prisma.TransactionClient, input: {
        tenantId: string;
        aggregateType: string;
        aggregateId: string;
        eventType: string;
        payload?: Prisma.InputJsonValue;
    }): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        aggregateType: string;
        aggregateId: string;
        eventType: string;
        payload: Prisma.JsonValue | null;
    }>;
    emit(prisma: PrismaClient, input: {
        tenantId: string;
        aggregateType: string;
        aggregateId: string;
        eventType: string;
        payload?: Prisma.InputJsonValue;
    }): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        aggregateType: string;
        aggregateId: string;
        eventType: string;
        payload: Prisma.JsonValue | null;
    }>;
}
