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
exports.PlatformAuditService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../database/prisma.service");
let PlatformAuditService = class PlatformAuditService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async log(action, actorUserId, targetTenantId, metadata) {
        return this.prisma.platformAuditLog.create({
            data: {
                action,
                actorUserId,
                targetTenantId,
                ...(metadata !== undefined ? { metadata } : {}),
            },
        });
    }
    async list(params) {
        const take = Math.min(params.take ?? 50, 200);
        const skip = params.skip ?? 0;
        const where = {};
        if (params.action)
            where.action = params.action;
        if (params.targetTenantId)
            where.targetTenantId = params.targetTenantId;
        const [rows, total] = await Promise.all([
            this.prisma.platformAuditLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take,
            }),
            this.prisma.platformAuditLog.count({ where }),
        ]);
        const actorIds = [...new Set(rows.map((r) => r.actorUserId).filter(Boolean))];
        const actors = actorIds.length > 0
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
};
exports.PlatformAuditService = PlatformAuditService;
exports.PlatformAuditService = PlatformAuditService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PlatformAuditService);
//# sourceMappingURL=platform-audit.service.js.map