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
exports.PlatformMetricsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../database/prisma.service");
const platform_tenant_1 = require("../common/constants/platform-tenant");
let PlatformMetricsService = class PlatformMetricsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async overview() {
        const clinicWhere = { deletedAt: null, id: { not: platform_tenant_1.PLATFORM_TENANT_ID } };
        const [totalClinics, activeClinics, suspendedClinics, trialClinics, totalUsers, totalPatients, appointmentsToday,] = await Promise.all([
            this.prisma.tenant.count({ where: clinicWhere }),
            this.prisma.tenant.count({ where: { ...clinicWhere, status: client_1.TenantStatus.active } }),
            this.prisma.tenant.count({ where: { ...clinicWhere, status: client_1.TenantStatus.suspended } }),
            this.prisma.tenant.count({ where: { ...clinicWhere, status: client_1.TenantStatus.trial } }),
            this.prisma.user.count({ where: { deletedAt: null, tenantId: { not: platform_tenant_1.PLATFORM_TENANT_ID } } }),
            this.prisma.patient.count({ where: { deletedAt: null, tenantId: { not: platform_tenant_1.PLATFORM_TENANT_ID } } }),
            this.appointmentsTodayCount(),
        ]);
        const activitySeries = await this.lastSevenDaysAppointmentCounts();
        return {
            totalClinics,
            activeClinics,
            suspendedClinics,
            trialClinics,
            totalUsers,
            totalPatients,
            appointmentsToday,
            activitySeries,
            clinicsByStatus: [
                { name: 'Active', value: activeClinics },
                { name: 'Suspended', value: suspendedClinics },
                { name: 'Trial', value: trialClinics },
            ],
        };
    }
    async appointmentsTodayCount() {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        return this.prisma.appointment.count({
            where: {
                deletedAt: null,
                tenantId: { not: platform_tenant_1.PLATFORM_TENANT_ID },
                startTime: { gte: start, lte: end },
            },
        });
    }
    async lastSevenDaysAppointmentCounts() {
        const series = [];
        for (let i = 6; i >= 0; i -= 1) {
            const day = new Date();
            day.setDate(day.getDate() - i);
            day.setHours(0, 0, 0, 0);
            const next = new Date(day);
            next.setDate(next.getDate() + 1);
            const count = await this.prisma.appointment.count({
                where: {
                    deletedAt: null,
                    tenantId: { not: platform_tenant_1.PLATFORM_TENANT_ID },
                    startTime: { gte: day, lt: next },
                },
            });
            series.push({ date: day.toISOString().slice(0, 10), count });
        }
        return series;
    }
};
exports.PlatformMetricsService = PlatformMetricsService;
exports.PlatformMetricsService = PlatformMetricsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PlatformMetricsService);
//# sourceMappingURL=platform-metrics.service.js.map