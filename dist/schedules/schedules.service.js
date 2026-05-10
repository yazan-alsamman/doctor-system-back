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
exports.SchedulesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../database/prisma.service");
const tenant_prisma_helper_1 = require("../common/tenant-prisma.helper");
const client_1 = require("@prisma/client");
let SchedulesService = class SchedulesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    list(auth) {
        const scope = auth.role === client_1.UserRole.doctor ? { doctorId: auth.userId, deletedAt: null } : { deletedAt: null };
        return this.prisma.doctorSchedule.findMany({
            where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, scope),
            orderBy: [{ doctorId: 'asc' }, { dayOfWeek: 'asc' }],
        });
    }
    async upsert(auth, dto) {
        if (auth.role === client_1.UserRole.doctor && dto.doctorId !== auth.userId) {
            throw new common_1.ForbiddenException({
                message: 'Doctors may only edit their own schedule',
                code: 'SCHEDULE_FORBIDDEN',
                status: 403,
            });
        }
        const doctor = await this.prisma.user.findFirst({
            where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, { id: dto.doctorId, role: client_1.UserRole.doctor }),
            select: { id: true },
        });
        if (!doctor)
            throw new common_1.NotFoundException('Doctor not found in this clinic');
        return this.prisma.doctorSchedule.upsert({
            where: {
                tenantId_doctorId_dayOfWeek: {
                    tenantId: auth.tenantId,
                    doctorId: dto.doctorId,
                    dayOfWeek: dto.dayOfWeek,
                },
            },
            update: {
                startTime: dto.startTime,
                endTime: dto.endTime,
                breakStart: dto.breakStart ?? null,
                breakEnd: dto.breakEnd ?? null,
                deletedAt: null,
            },
            create: {
                tenantId: auth.tenantId,
                doctorId: dto.doctorId,
                dayOfWeek: dto.dayOfWeek,
                startTime: dto.startTime,
                endTime: dto.endTime,
                breakStart: dto.breakStart,
                breakEnd: dto.breakEnd,
            },
        });
    }
    async remove(auth, doctorId, dayOfWeek) {
        if (auth.role === client_1.UserRole.doctor && doctorId !== auth.userId) {
            throw new common_1.ForbiddenException({
                message: 'Doctors may only edit their own schedule',
                code: 'SCHEDULE_FORBIDDEN',
                status: 403,
            });
        }
        const doctor = await this.prisma.user.findFirst({
            where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, { id: doctorId }),
            select: { id: true },
        });
        if (!doctor)
            throw new common_1.NotFoundException('Doctor not found in this clinic');
        const result = await this.prisma.doctorSchedule.updateMany({
            where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, { doctorId, dayOfWeek }),
            data: { deletedAt: new Date() },
        });
        return { deleted: result.count };
    }
};
exports.SchedulesService = SchedulesService;
exports.SchedulesService = SchedulesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SchedulesService);
//# sourceMappingURL=schedules.service.js.map