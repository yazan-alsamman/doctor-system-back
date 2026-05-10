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
exports.ServicesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../database/prisma.service");
const tenant_prisma_helper_1 = require("../common/tenant-prisma.helper");
let ServicesService = class ServicesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async assertDoctorInTenant(auth, doctorId) {
        const doctor = await this.prisma.user.findFirst({
            where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, { id: doctorId, role: client_1.UserRole.doctor }),
        });
        if (!doctor) {
            throw new common_1.BadRequestException('الطبيب غير موجود في العيادة أو ليس بدور طبيب');
        }
    }
    list(auth, doctorId) {
        const scopedDoctorId = auth.role === 'doctor' ? auth.userId : doctorId;
        return this.prisma.service.findMany({
            where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, scopedDoctorId ? { doctorId: scopedDoctorId } : undefined),
            orderBy: { name: 'asc' },
        });
    }
    async create(auth, dto) {
        const doctorId = auth.role === 'doctor' ? auth.userId : dto.doctorId ?? null;
        if (!doctorId) {
            throw new common_1.BadRequestException('يجب اختيار طبيب لكل إجراء');
        }
        await this.assertDoctorInTenant(auth, doctorId);
        return this.prisma.service.create({
            data: {
                id: dto.id,
                tenantId: auth.tenantId,
                doctorId,
                name: dto.name,
                price: dto.price,
                durationMinutes: dto.durationMinutes,
                category: dto.category || 'general',
                aliases: dto.aliases || [],
                active: dto.active ?? true,
            },
        });
    }
    async update(auth, id, dto) {
        if (dto.doctorId === null) {
            throw new common_1.BadRequestException('لا يمكن إلغاء ربط الإجراء عن الطبيب');
        }
        if (dto.doctorId && auth.role !== 'doctor') {
            await this.assertDoctorInTenant(auth, dto.doctorId);
        }
        await this.prisma.service.updateMany({
            where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, auth.role === 'doctor' ? { id, doctorId: auth.userId } : { id }),
            data: {
                doctorId: auth.role === 'doctor' ? auth.userId : dto.doctorId ?? undefined,
                name: dto.name,
                price: dto.price,
                durationMinutes: dto.durationMinutes,
                category: dto.category,
                aliases: dto.aliases,
                active: dto.active,
            },
        });
        return this.prisma.service.findFirst({ where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, { id }) });
    }
    remove(auth, id) {
        return this.prisma.service.updateMany({
            where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, auth.role === 'doctor' ? { id, doctorId: auth.userId } : { id }),
            data: { deletedAt: new Date() },
        });
    }
};
exports.ServicesService = ServicesService;
exports.ServicesService = ServicesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ServicesService);
//# sourceMappingURL=services.service.js.map