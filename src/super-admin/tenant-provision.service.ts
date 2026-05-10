import { BadRequestException, Injectable } from '@nestjs/common';
import { SubscriptionStatus, TenantStatus, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { PLATFORM_TENANT_ID } from '../common/constants/platform-tenant';
import type { CreateClinicDto } from './dto/create-clinic.dto';
import { PlatformAuditService } from './platform-audit.service';

@Injectable()
export class TenantProvisionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PlatformAuditService,
  ) {}

  async provision(actorUserId: string, dto: CreateClinicDto) {
    const email = dto.adminEmail.trim().toLowerCase();
    const dup = await this.prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
        tenantId: { not: PLATFORM_TENANT_ID },
      },
    });
    if (dup) {
      throw new BadRequestException({
        message: 'This admin email is already used by another clinic.',
        code: 'EMAIL_TAKEN',
        status: 400,
      });
    }

    const passwordHash = await bcrypt.hash(dto.adminPassword, 10);

    const tenant = await this.prisma.$transaction(async (tx) => {
      const t = await tx.tenant.create({
        data: {
          name: dto.clinicName.trim(),
          status: TenantStatus.trial,
          plan: dto.plan,
          subscriptionStatus: SubscriptionStatus.trial,
        },
      });

      await tx.user.create({
        data: {
          tenantId: t.id,
          name: dto.adminName.trim(),
          email,
          passwordHash,
          role: UserRole.admin,
          active: true,
        },
      });

      await tx.service.createMany({
        data: [
          {
            tenantId: t.id,
            name: 'Consultation',
            price: 0,
            durationMinutes: 30,
            category: 'general',
            aliases: ['consultation', 'استشارة'],
            active: true,
          },
          {
            tenantId: t.id,
            name: 'Basic treatment',
            price: 0,
            durationMinutes: 45,
            category: 'general',
            aliases: ['treatment', 'علاج'],
            active: true,
          },
        ],
      });

      return t;
    });

    await this.audit.log('CLINIC_CREATED', actorUserId, tenant.id, {
      clinicName: tenant.name,
      plan: dto.plan,
      adminEmail: email,
    });

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      plan: tenant.plan,
      status: tenant.status,
      adminEmail: email,
      message: 'Clinic provisioned. Default services added; add doctors in the clinic app to enable schedules.',
    };
  }
}
