import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TenantStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { PLATFORM_TENANT_ID } from '../common/constants/platform-tenant';
import type { PatchTenantDto } from './dto/patch-tenant.dto';
import { PlatformAuditService } from './platform-audit.service';

type ListParams = {
  search?: string;
  status?: TenantStatus;
  skip?: number;
  take?: number;
};

@Injectable()
export class TenantManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PlatformAuditService,
  ) {}

  private assertClinicTenant(id: string) {
    if (id === PLATFORM_TENANT_ID) {
      throw new BadRequestException('Invalid tenant id');
    }
  }

  async list(params: ListParams) {
    const take = Math.min(params.take ?? 50, 100);
    const skip = params.skip ?? 0;
    const where: Prisma.TenantWhereInput = {
      deletedAt: null,
      id: { not: PLATFORM_TENANT_ID },
    };
    if (params.status) where.status = params.status;
    if (params.search?.trim()) {
      where.name = { contains: params.search.trim(), mode: 'insensitive' };
    }

    const [rows, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          _count: {
            select: { users: true, patients: true },
          },
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    const tenantIds = rows.map((r) => r.id);
    const lastMap = await this.lastActivityByTenant(tenantIds);

    return {
      total,
      items: rows.map((t) => ({
        id: t.id,
        name: t.name,
        status: t.status,
        plan: t.plan,
        subscriptionStatus: t.subscriptionStatus,
        nextBillingDate: t.nextBillingDate,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        userCount: t._count.users,
        patientCount: t._count.patients,
        lastActivityAt: lastMap.get(t.id) ?? t.updatedAt,
      })),
    };
  }

  private async lastActivityByTenant(tenantIds: string[]): Promise<Map<string, Date>> {
    const map = new Map<string, Date>();
    await Promise.all(
      tenantIds.map(async (tid) => {
        const row = await this.prisma.appointment.findFirst({
          where: { tenantId: tid, deletedAt: null },
          orderBy: { updatedAt: 'desc' },
          select: { updatedAt: true },
        });
        if (row) map.set(tid, row.updatedAt);
      }),
    );
    return map;
  }

  async getOne(id: string) {
    this.assertClinicTenant(id);
    const t = await this.prisma.tenant.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: { select: { users: true, patients: true, appointments: true } },
      },
    });
    if (!t) throw new NotFoundException('Clinic not found');
    const lastMap = await this.lastActivityByTenant([id]);
    return {
      id: t.id,
      name: t.name,
      status: t.status,
      plan: t.plan,
      subscriptionStatus: t.subscriptionStatus,
      nextBillingDate: t.nextBillingDate,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      userCount: t._count.users,
      patientCount: t._count.patients,
      appointmentCount: t._count.appointments,
      lastActivityAt: lastMap.get(id) ?? t.updatedAt,
    };
  }

  async patch(actorUserId: string, id: string, dto: PatchTenantDto) {
    this.assertClinicTenant(id);
    const existing = await this.prisma.tenant.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException('Clinic not found');

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.plan !== undefined ? { plan: dto.plan } : {}),
        ...(dto.subscriptionStatus !== undefined ? { subscriptionStatus: dto.subscriptionStatus } : {}),
        ...(dto.nextBillingDate !== undefined ? { nextBillingDate: dto.nextBillingDate } : {}),
      },
    });

    if (dto.plan !== undefined && dto.plan !== existing.plan) {
      await this.audit.log('PLAN_CHANGED', actorUserId, id, { from: existing.plan, to: dto.plan });
    }
    if (dto.status !== undefined && dto.status !== existing.status) {
      await this.audit.log('TENANT_STATUS_CHANGED', actorUserId, id, {
        from: existing.status,
        to: dto.status,
      });
    }
    if (dto.subscriptionStatus !== undefined && dto.subscriptionStatus !== existing.subscriptionStatus) {
      await this.audit.log('SUBSCRIPTION_STATUS_CHANGED', actorUserId, id, {
        from: existing.subscriptionStatus,
        to: dto.subscriptionStatus,
      });
    }

    return updated;
  }

  async suspend(actorUserId: string, id: string) {
    this.assertClinicTenant(id);
    const t = await this.prisma.tenant.updateMany({
      where: { id, deletedAt: null },
      data: { status: TenantStatus.suspended },
    });
    if (t.count === 0) throw new NotFoundException('Clinic not found');
    await this.audit.log('CLINIC_SUSPENDED', actorUserId, id, {});
    return { ok: true };
  }

  async reactivate(actorUserId: string, id: string) {
    this.assertClinicTenant(id);
    const t = await this.prisma.tenant.updateMany({
      where: { id, deletedAt: null },
      data: { status: TenantStatus.active },
    });
    if (t.count === 0) throw new NotFoundException('Clinic not found');
    await this.audit.log('CLINIC_REACTIVATED', actorUserId, id, {});
    return { ok: true };
  }

  async softDelete(actorUserId: string, id: string) {
    this.assertClinicTenant(id);
    const now = new Date();
    const t = await this.prisma.tenant.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: now, status: TenantStatus.suspended },
    });
    if (t.count === 0) throw new NotFoundException('Clinic not found');
    await this.audit.log('CLINIC_SOFT_DELETED', actorUserId, id, {});
    return { ok: true };
  }
}
