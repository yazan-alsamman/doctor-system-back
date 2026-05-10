import { PrismaService } from '../../database/prisma.service';
export type IdempotentReplay<T = unknown> = {
    responseStatus: number;
    responseBody: T;
};
export declare class IdempotencyService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    requestHash(operation: string, payload: unknown): string;
    private ttlMs;
    replayOrNull<T = unknown>(tenantId: string, actorUserId: string, idempotencyKey: string, hash: string, requestPath: string, requestMethod: string): Promise<IdempotentReplay<T> | null>;
    saveSuccess<T = unknown>(tenantId: string, actorUserId: string, idempotencyKey: string, hash: string, requestPath: string, requestMethod: string, responseStatus: number, responseBody: T): Promise<void>;
}
