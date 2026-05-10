import { PrismaService } from '../../../database/prisma.service';
import type { AuthContext } from '../../../common/auth-context';
export declare class CopilotAuthorizationService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    resolveDoctorId(auth: AuthContext, requested?: string): Promise<string | undefined | null>;
    canReadClinicalPatient(auth: AuthContext, patientId: string): Promise<boolean>;
    parseUuid(value: unknown): string | null;
}
