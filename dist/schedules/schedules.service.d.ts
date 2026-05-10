import { PrismaService } from '../database/prisma.service';
import { AuthContext } from '../common/auth-context';
import { CreateScheduleDto } from './dto/create-schedule.dto';
export declare class SchedulesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    list(auth: AuthContext): import("@prisma/client").Prisma.PrismaPromise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        tenantId: string;
        doctorId: string;
        startTime: string;
        endTime: string;
        dayOfWeek: number;
        breakStart: string | null;
        breakEnd: string | null;
    }[]>;
    upsert(auth: AuthContext, dto: CreateScheduleDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        tenantId: string;
        doctorId: string;
        startTime: string;
        endTime: string;
        dayOfWeek: number;
        breakStart: string | null;
        breakEnd: string | null;
    }>;
    remove(auth: AuthContext, doctorId: string, dayOfWeek: number): Promise<{
        deleted: number;
    }>;
}
