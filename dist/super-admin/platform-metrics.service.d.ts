import { PrismaService } from '../database/prisma.service';
export declare class PlatformMetricsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    overview(): Promise<{
        totalClinics: number;
        activeClinics: number;
        suspendedClinics: number;
        trialClinics: number;
        totalUsers: number;
        totalPatients: number;
        appointmentsToday: number;
        activitySeries: {
            date: string;
            count: number;
        }[];
        clinicsByStatus: {
            name: string;
            value: number;
        }[];
    }>;
    private appointmentsTodayCount;
    private lastSevenDaysAppointmentCounts;
}
