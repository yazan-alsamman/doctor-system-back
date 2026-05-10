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
var CopilotAuthorizationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopilotAuthorizationService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const prisma_service_1 = require("../../../database/prisma.service");
const UUID = zod_1.z.string().uuid();
let CopilotAuthorizationService = CopilotAuthorizationService_1 = class CopilotAuthorizationService {
    prisma;
    logger = new common_1.Logger(CopilotAuthorizationService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async resolveDoctorId(auth, requested) {
        if (auth.role === client_1.UserRole.doctor) {
            return auth.userId;
        }
        const trimmed = requested?.trim();
        if (!trimmed)
            return undefined;
        if (!UUID.safeParse(trimmed).success) {
            this.logger.debug('reject doctorId: invalid UUID');
            return null;
        }
        const user = await this.prisma.user.findFirst({
            where: {
                id: trimmed,
                tenantId: auth.tenantId,
                role: client_1.UserRole.doctor,
                deletedAt: null,
                active: true,
            },
            select: { id: true },
        });
        if (!user) {
            this.logger.debug('reject doctorId: not a doctor in tenant');
            return null;
        }
        return user.id;
    }
    async canReadClinicalPatient(auth, patientId) {
        if (auth.role !== client_1.UserRole.doctor)
            return true;
        const hit = await this.prisma.appointment.findFirst({
            where: {
                tenantId: auth.tenantId,
                patientId,
                doctorId: auth.userId,
                deletedAt: null,
            },
            select: { id: true },
        });
        return Boolean(hit);
    }
    parseUuid(value) {
        if (value === undefined || value === null)
            return null;
        const s = String(value).trim();
        if (!s)
            return null;
        const r = UUID.safeParse(s);
        return r.success ? r.data : null;
    }
};
exports.CopilotAuthorizationService = CopilotAuthorizationService;
exports.CopilotAuthorizationService = CopilotAuthorizationService = CopilotAuthorizationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CopilotAuthorizationService);
//# sourceMappingURL=copilot-authorization.service.js.map