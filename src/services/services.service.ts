import { BadRequestException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuthContext } from '../common/auth-context';
import { tenantWhere } from '../common/tenant-prisma.helper';
import { CreateServiceDto } from './dto/create-service.dto';
import type { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertDoctorInTenant(auth: AuthContext, doctorId: string) {
    const doctor = await this.prisma.user.findFirst({
      where: tenantWhere(auth.tenantId, { id: doctorId, role: UserRole.doctor }),
    });
    if (!doctor) {
      throw new BadRequestException('الطبيب غير موجود في العيادة أو ليس بدور طبيب');
    }
  }

  list(auth: AuthContext, doctorId?: string) {
    // Service.doctorId is a FK to User.id — not doctorCode (e.g. DK1)
    const scopedDoctorId = auth.role === 'doctor' ? auth.userId : doctorId;
    return this.prisma.service.findMany({
      where: tenantWhere(auth.tenantId, scopedDoctorId ? { doctorId: scopedDoctorId } : undefined),
      orderBy: { name: 'asc' },
    });
  }

  async create(auth: AuthContext, dto: CreateServiceDto) {
    const doctorId = auth.role === 'doctor' ? auth.userId : dto.doctorId ?? null;
    if (!doctorId) {
      throw new BadRequestException('يجب اختيار طبيب لكل إجراء');
    }
    await this.assertDoctorInTenant(auth, doctorId);
    return this.prisma.service.create({
      data: {
        id: dto.id,
        tenantId: auth.tenantId,
        doctorId,
        name: dto.name,
        price: dto.price,
        durationMinutes: dto.durationMinutes,
        category: dto.category || 'general',
        aliases: dto.aliases || [],
        active: dto.active ?? true,
      },
    });
  }

  async update(auth: AuthContext, id: string, dto: UpdateServiceDto) {
    if (dto.doctorId === null) {
      throw new BadRequestException('لا يمكن إلغاء ربط الإجراء عن الطبيب');
    }
    if (dto.doctorId && auth.role !== 'doctor') {
      await this.assertDoctorInTenant(auth, dto.doctorId);
    }
    await this.prisma.service.updateMany({
      where: tenantWhere(
        auth.tenantId,
        auth.role === 'doctor' ? { id, doctorId: auth.userId } : { id },
      ),
      data: {
        doctorId: auth.role === 'doctor' ? auth.userId : dto.doctorId ?? undefined,
        name: dto.name,
        price: dto.price,
        durationMinutes: dto.durationMinutes,
        category: dto.category,
        aliases: dto.aliases,
        active: dto.active,
      },
    });
    return this.prisma.service.findFirst({ where: tenantWhere(auth.tenantId, { id }) });
  }

  remove(auth: AuthContext, id: string) {
    return this.prisma.service.updateMany({
      where: tenantWhere(
        auth.tenantId,
        auth.role === 'doctor' ? { id, doctorId: auth.userId } : { id },
      ),
      data: { deletedAt: new Date() },
    });
  }
}
