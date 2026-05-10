"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../database/prisma.service");
let NotificationsService = class NotificationsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createForUser(tenantId, userId, type, message) {
        return this.prisma.notification.create({
            data: {
                tenantId,
                userId,
                type,
                message,
            },
        });
    }
    async notifyUsersWithRoles(tenantId, roles, type, message) {
        const users = await this.prisma.user.findMany({
            where: {
                tenantId,
                deletedAt: null,
                active: true,
                role: { in: roles },
            },
            select: { id: true },
        });
        if (!users.length)
            return;
        await this.prisma.notification.createMany({
            data: users.map((u) => ({
                tenantId,
                userId: u.id,
                type,
                message,
            })),
        });
    }
    listForUser(userId, tenantId, opts) {
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
    async markRead(userId, tenantId, id) {
        await this.prisma.notification.updateMany({
            where: { id, tenantId, userId },
            data: { read: true },
        });
        return this.prisma.notification.findFirst({
            where: { id, tenantId, userId },
        });
    }
    async markAllRead(userId, tenantId) {
        return this.prisma.notification.updateMany({
            where: { tenantId, userId, read: false },
            data: { read: true },
        });
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map