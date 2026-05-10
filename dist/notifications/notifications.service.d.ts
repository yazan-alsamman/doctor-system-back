import { NotificationSeverity, UserRole } from "@prisma/client";
import { PrismaService } from '../database/prisma.service';
export declare class NotificationsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    createForUser(tenantId: string, userId: string, type: NotificationSeverity, message: string): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        userId: string;
        type: import("@prisma/client").$Enums.NotificationSeverity;
        message: string;
        read: boolean;
    }>;
    notifyUsersWithRoles(tenantId: string, roles: UserRole[], type: NotificationSeverity, message: string): Promise<void>;
    listForUser(userId: string, tenantId: string, opts?: {
        unreadOnly?: boolean;
        limit?: number;
    }): import("@prisma/client").Prisma.PrismaPromise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        userId: string;
        type: import("@prisma/client").$Enums.NotificationSeverity;
        message: string;
        read: boolean;
    }[]>;
    markRead(userId: string, tenantId: string, id: string): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        userId: string;
        type: import("@prisma/client").$Enums.NotificationSeverity;
        message: string;
        read: boolean;
    } | null>;
    markAllRead(userId: string, tenantId: string): Promise<import("@prisma/client").Prisma.BatchPayload>;
}
