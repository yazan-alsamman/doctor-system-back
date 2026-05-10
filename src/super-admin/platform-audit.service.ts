import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class PlatformAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    action: string,
    actorUserId: string | null,
    targetTenantId: string | null,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.prisma.platformAuditLog.create({
      data: {
        action,
        actorUserId,
        targetTenantId,
        ...(metadata !== undefined ? { metadata } : {}),
      },
    });
  }

  async list(params: {
    action?: string;
    targetTenantId?: string;
    skip?: number;
    take?: number;
  }) {
    const take = Math.min(params.take ?? 50, 200);
    const skip = params.skip ?? 0;
    const where: Prisma.PlatformAuditLogWhereInput = {};
    if (params.action) where.action = params.action;
    if (params.targetTenantId) where.targetTenantId = params.targetTenantId;

    const [rows, total] = await Promise.all([
      this.prisma.platformAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.platformAuditLog.count({ where }),
    ]);

    const actorIds = [...new Set(rows.map((r) => r.actorUserId).filter(Boolean))] as string[];
    const actors =
      actorIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: actorIds } },
            select: { id: true, email: true, name: true, role: true },
          })
        : [];
    const actorMap = new Map(actors.map((a) => [a.id, a]));

    return {
      total,
      items: rows.map((r) => ({
        id: r.id,
        action: r.action,
        targetTenantId: r.targetTenantId,
        metadata: r.metadata,
        createdAt: r.createdAt,
        actor: r.actorUserId ? actorMap.get(r.actorUserId) ?? null : null,
      })),
    };
  }
}
