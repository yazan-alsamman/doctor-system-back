import type { AuthContext } from '../common/auth-context';
import { NotificationsService } from './notifications.service';
export declare class NotificationsController {
    private readonly notifications;
    constructor(notifications: NotificationsService);
    list(auth: AuthContext, unreadOnly?: string, limit?: string): import("@prisma/client").Prisma.PrismaPromise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        userId: string;
        type: import("@prisma/client").$Enums.NotificationSeverity;
        message: string;
        read: boolean;
    }[]>;
    markAllRead(auth: AuthContext): Promise<import("@prisma/client").Prisma.BatchPayload>;
    markRead(auth: AuthContext, id: string): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        userId: string;
        type: import("@prisma/client").$Enums.NotificationSeverity;
        message: string;
        read: boolean;
    } | null>;
}
