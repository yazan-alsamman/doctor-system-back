import { Injectable } from '@nestjs/common';
import { TenantStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { PLATFORM_TENANT_ID } from '../common/constants/platform-tenant';

@Injectable()
export class PlatformMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const clinicWhere = { deletedAt: null, id: { not: PLATFORM_TENANT_ID } };

    const [
      totalClinics,
      activeClinics,
      suspendedClinics,
      trialClinics,
      totalUsers,
      totalPatients,
      appointmentsToday,
    ] = await Promise.all([
      this.prisma.tenant.count({ where: clinicWhere }),
      this.prisma.tenant.count({ where: { ...clinicWhere, status: TenantStatus.active } }),
      this.prisma.tenant.count({ where: { ...clinicWhere, status: TenantStatus.suspended } }),
      this.prisma.tenant.count({ where: { ...clinicWhere, status: TenantStatus.trial } }),
      this.prisma.user.count({ where: { deletedAt: null, tenantId: { not: PLATFORM_TENANT_ID } } }),
      this.prisma.patient.count({ where: { deletedAt: null, tenantId: { not: PLATFORM_TENANT_ID } } }),
      this.appointmentsTodayCount(),
    ]);

    const activitySeries = await this.lastSevenDaysAppointmentCounts();

    return {
      totalClinics,
      activeClinics,
      suspendedClinics,
      trialClinics,
      totalUsers,
      totalPatients,
      appointmentsToday,
      activitySeries,
      clinicsByStatus: [
        { name: 'Active', value: activeClinics },
        { name: 'Suspended', value: suspendedClinics },
        { name: 'Trial', value: trialClinics },
      ],
    };
  }

  private async appointmentsTodayCount(): Promise<number> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return this.prisma.appointment.count({
      where: {
        deletedAt: null,
        tenantId: { not: PLATFORM_TENANT_ID },
        startTime: { gte: start, lte: end },
      },
    });
  }

  private async lastSevenDaysAppointmentCounts(): Promise<{ date: string; count: number }[]> {
    const series: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      day.setHours(0, 0, 0, 0);
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      const count = await this.prisma.appointment.count({
        where: {
          deletedAt: null,
          tenantId: { not: PLATFORM_TENANT_ID },
          startTime: { gte: day, lt: next },
        },
      });
      series.push({ date: day.toISOString().slice(0, 10), count });
    }
    return series;
  }
}
