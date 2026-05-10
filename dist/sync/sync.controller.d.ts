import type { AuthContext } from '../common/auth-context';
import type { SyncBatchDto } from './dto/sync-batch.dto';
import { SyncService } from './sync.service';
export declare class SyncController {
    private readonly syncService;
    constructor(syncService: SyncService);
    getChanges(auth: AuthContext, cursor?: string, limit?: string, types?: string): Promise<{
        items: import("./sync.service").SyncChangeItem[];
        nextCursor: string | null;
        serverTime: string;
        hasMore: boolean;
    }>;
    getStatus(auth: AuthContext): Promise<{
        serverTime: string;
        tenantId: string;
        idempotencyTtlHours: number;
    }>;
    applyBatch(auth: AuthContext, body: SyncBatchDto): Promise<{
        results: {
            opIndex: number;
            status: number;
            ok: boolean;
            data?: unknown;
            error?: {
                code?: string;
                message: string;
                status: number;
            };
        }[];
    }>;
}
