import { PrismaService } from '../database/prisma.service';
export declare class PlatformHealthService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    snapshot(): Promise<{
        api: {
            status: "up";
        };
        database: {
            status: "up" | "down";
        };
        lastBackupAt: string;
        errorLogCount: number;
    }>;
    private pingDb;
}
