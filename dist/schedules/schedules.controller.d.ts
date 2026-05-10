import { SchedulesService } from './schedules.service';
import type { AuthContext } from '../common/auth-context';
import type { CreateScheduleDto } from './dto/create-schedule.dto';
export declare class SchedulesController {
    private readonly schedulesService;
    constructor(schedulesService: SchedulesService);
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
    upsert(auth: AuthContext, body: CreateScheduleDto): Promise<{
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
