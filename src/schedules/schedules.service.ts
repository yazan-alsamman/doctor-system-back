import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuthContext } from '../common/auth-context';
import { tenantWhere } from '../common/tenant-prisma.helper';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class SchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  list(auth: AuthContext) {
    const scope =
      auth.role === UserRole.doctor ? { doctorId: auth.userId, deletedAt: null } : { deletedAt: null };
    return this.prisma.doctorSchedule.findMany({
      where: tenantWhere(auth.tenantId, scope),
      orderBy: [{ doctorId: 'asc' }, { dayOfWeek: 'asc' }],
    });
  }

  /**
   * Creates or replaces the schedule for a given doctor+day.
   * The @@unique([tenantId, doctorId, dayOfWeek]) constraint ensures only one row per slot.
   */
  async upsert(auth: AuthContext, dto: CreateScheduleDto) {
    if (auth.role === UserRole.doctor && dto.doctorId !== auth.userId) {
      throw new ForbiddenException({
        message: 'Doctors may only edit their own schedule',
        code: 'SCHEDULE_FORBIDDEN',
        status: 403,
      });
    }
    // Validate that the doctorId belongs to this tenant
    const doctor = await this.prisma.user.findFirst({
      where: tenantWhere(auth.tenantId, { id: dto.doctorId, role: UserRole.doctor }),
      select: { id: true },
    });
    if (!doctor) throw new NotFoundException('Doctor not found in this clinic');

    return this.prisma.doctorSchedule.upsert({
      where: {
        tenantId_doctorId_dayOfWeek: {
          tenantId: auth.tenantId,
          doctorId: dto.doctorId,
          dayOfWeek: dto.dayOfWeek,
        },
      },
      update: {
        startTime: dto.startTime,
        endTime: dto.endTime,
        breakStart: dto.breakStart ?? null,
        breakEnd: dto.breakEnd ?? null,
        deletedAt: null,
      },
      create: {
        tenantId: auth.tenantId,
        doctorId: dto.doctorId,
        dayOfWeek: dto.dayOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
        breakStart: dto.breakStart,
        breakEnd: dto.breakEnd,
      },
    });
  }

  async remove(auth: AuthContext, doctorId: string, dayOfWeek: number) {
    if (auth.role === UserRole.doctor && doctorId !== auth.userId) {
      throw new ForbiddenException({
        message: 'Doctors may only edit their own schedule',
        code: 'SCHEDULE_FORBIDDEN',
        status: 403,
      });
    }
    // Validate the doctor belongs to this tenant
    const doctor = await this.prisma.user.findFirst({
      where: tenantWhere(auth.tenantId, { id: doctorId }),
      select: { id: true },
    });
    if (!doctor) throw new NotFoundException('Doctor not found in this clinic');

    const result = await this.prisma.doctorSchedule.updateMany({
      where: tenantWhere(auth.tenantId, { doctorId, dayOfWeek }),
      data: { deletedAt: new Date() },
    });
    return { deleted: result.count };
  }
}
