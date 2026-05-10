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
exports.TenantManagementService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../database/prisma.service");
const platform_tenant_1 = require("../common/constants/platform-tenant");
const platform_audit_service_1 = require("./platform-audit.service");
let TenantManagementService = class TenantManagementService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    assertClinicTenant(id) {
        if (id === platform_tenant_1.PLATFORM_TENANT_ID) {
            throw new common_1.BadRequestException('Invalid tenant id');
        }
    }
    async list(params) {
        const take = Math.min(params.take ?? 50, 100);
        const skip = params.skip ?? 0;
        const where = {
            deletedAt: null,
            id: { not: platform_tenant_1.PLATFORM_TENANT_ID },
        };
        if (params.status)
            where.status = params.status;
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
    async lastActivityByTenant(tenantIds) {
        const map = new Map();
        await Promise.all(tenantIds.map(async (tid) => {
            const row = await this.prisma.appointment.findFirst({
                where: { tenantId: tid, deletedAt: null },
                orderBy: { updatedAt: 'desc' },
                select: { updatedAt: true },
            });
            if (row)
                map.set(tid, row.updatedAt);
        }));
        return map;
    }
    async getOne(id) {
        this.assertClinicTenant(id);
        const t = await this.prisma.tenant.findFirst({
            where: { id, deletedAt: null },
            include: {
                _count: { select: { users: true, patients: true, appointments: true } },
            },
        });
        if (!t)
            throw new common_1.NotFoundException('Clinic not found');
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
    async patch(actorUserId, id, dto) {
        this.assertClinicTenant(id);
        const existing = await this.prisma.tenant.findFirst({ where: { id, deletedAt: null } });
        if (!existing)
            throw new common_1.NotFoundException('Clinic not found');
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
    async suspend(actorUserId, id) {
        this.assertClinicTenant(id);
        const t = await this.prisma.tenant.updateMany({
            where: { id, deletedAt: null },
            data: { status: client_1.TenantStatus.suspended },
        });
        if (t.count === 0)
            throw new common_1.NotFoundException('Clinic not found');
        await this.audit.log('CLINIC_SUSPENDED', actorUserId, id, {});
        return { ok: true };
    }
    async reactivate(actorUserId, id) {
        this.assertClinicTenant(id);
        const t = await this.prisma.tenant.updateMany({
            where: { id, deletedAt: null },
            data: { status: client_1.TenantStatus.active },
        });
        if (t.count === 0)
            throw new common_1.NotFoundException('Clinic not found');
        await this.audit.log('CLINIC_REACTIVATED', actorUserId, id, {});
        return { ok: true };
    }
    async softDelete(actorUserId, id) {
        this.assertClinicTenant(id);
        const now = new Date();
        const t = await this.prisma.tenant.updateMany({
            where: { id, deletedAt: null },
            data: { deletedAt: now, status: client_1.TenantStatus.suspended },
        });
        if (t.count === 0)
            throw new common_1.NotFoundException('Clinic not found');
        await this.audit.log('CLINIC_SOFT_DELETED', actorUserId, id, {});
        return { ok: true };
    }
};
exports.TenantManagementService = TenantManagementService;
exports.TenantManagementService = TenantManagementService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        platform_audit_service_1.PlatformAuditService])
], TenantManagementService);
//# sourceMappingURL=tenant-management.service.js.map