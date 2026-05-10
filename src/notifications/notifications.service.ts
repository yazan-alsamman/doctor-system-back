import { Injectable } from '@nestjs/common';
import { NotificationSeverity, UserRole } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createForUser(
    tenantId: string,
    userId: string,
    type: NotificationSeverity,
    message: string,
  ) {
    return this.prisma.notification.create({
      data: {
        tenantId,
        userId,
        type,
        message,
      },
    });
  }

  async notifyUsersWithRoles(
    tenantId: string,
    roles: UserRole[],
    type: NotificationSeverity,
    message: string,
  ) {
    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
        deletedAt: null,
        active: true,
        role: { in: roles },
      },
      select: { id: true },
    });
    if (!users.length) return;
    await this.prisma.notification.createMany({
      data: users.map((u) => ({
        tenantId,
        userId: u.id,
        type,
        message,
      })),
    });
  }

  listForUser(userId: string, tenantId: string, opts?: { unreadOnly?: boolean; limit?: number }) {
    const limit = Math.min(100, Math.max(1, opts?.limit ?? 40));
    return this.prisma.notification.findMany({
      where: {
        tenantId,
        userId,
        ...(opts?.unreadOnly ? { read: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async markRead(userId: string, tenantId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, tenantId, userId },
      data: { read: true },
    });
    return this.prisma.notification.findFirst({
      where: { id, tenantId, userId },
    });
  }

  async markAllRead(userId: string, tenantId: string) {
    return this.prisma.notification.updateMany({
      where: { tenantId, userId, read: false },
      data: { read: true },
    });
  }
}
