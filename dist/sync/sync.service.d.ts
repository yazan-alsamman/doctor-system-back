import { PrismaService } from '../database/prisma.service';
import type { AuthContext } from '../common/auth-context';
import { IdempotencyService } from '../common/idempotency/idempotency.service';
import { PatientsService } from '../patients/patients.service';
import { AppointmentsService } from '../appointments/appointments.service';
import type { SyncBatchDto } from './dto/sync-batch.dto';
export type SyncChangeItem = {
    entityType: 'Patient';
    id: string;
    op: 'UPSERT' | 'DELETE';
    updatedAt: string;
    versionToken: string;
    payload: Record<string, unknown>;
} | {
    entityType: 'Appointment';
    id: string;
    op: 'UPSERT' | 'DELETE';
    updatedAt: string;
    versionToken: string;
    payload: Record<string, unknown>;
};
export declare function encodeCursor(updatedAt: Date, id: string): string;
type BatchOpResult = {
    opIndex: number;
    status: number;
    ok: boolean;
    data?: unknown;
    error?: {
        code?: string;
        message: string;
        status: number;
    };
};
export declare class SyncService {
    private readonly prisma;
    private readonly idempotency;
    private readonly patients;
    private readonly appointments;
    private readonly logger;
    constructor(prisma: PrismaService, idempotency: IdempotencyService, patients: PatientsService, appointments: AppointmentsService);
    getChanges(auth: AuthContext, query: {
        cursor?: string;
        limit?: number;
        types?: string;
    }): Promise<{
        items: SyncChangeItem[];
        nextCursor: string | null;
        serverTime: string;
        hasMore: boolean;
    }>;
    private patientToChange;
    private appointmentToChange;
    applyBatch(auth: AuthContext, dto: SyncBatchDto): Promise<{
        results: BatchOpResult[];
    }>;
    private errorToResult;
    private executeOne;
    getSyncStatus(auth: AuthContext): Promise<{
        serverTime: string;
        tenantId: string;
        idempotencyTtlHours: number;
    }>;
}
export {};
