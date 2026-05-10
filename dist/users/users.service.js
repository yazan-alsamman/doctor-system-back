"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../database/prisma.service");
const tenant_prisma_helper_1 = require("../common/tenant-prisma.helper");
const role_permissions_1 = require("../common/role-permissions");
const access_matrix_1 = require("../common/access/access-matrix");
const bcrypt = __importStar(require("bcrypt"));
let UsersService = class UsersService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getSelf(auth) {
        const user = await this.prisma.user.findFirst({
            where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, { id: auth.userId }),
            select: {
                id: true,
                name: true,
                title: true,
                email: true,
                role: true,
                active: true,
                doctorCode: true,
                createdAt: true,
                featureOverrides: true,
            },
        });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        const { featureOverrides, ...rest } = user;
        const access = (0, access_matrix_1.mergeFeatureOverrides)(user.role, featureOverrides);
        return {
            ...rest,
            permissions: (0, role_permissions_1.permissionsForRole)(user.role),
            access,
        };
    }
    async updateSelf(auth, dto) {
        await this.prisma.user.updateMany({
            where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, { id: auth.userId }),
            data: { name: dto.name.trim() },
        });
        return this.getSelf(auth);
    }
    async changeOwnPassword(auth, dto) {
        const user = await this.prisma.user.findFirst({
            where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, { id: auth.userId }),
        });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
        if (!ok) {
            throw new common_1.UnauthorizedException({
                message: 'Current password is incorrect',
                code: 'INVALID_PASSWORD',
                status: 401,
            });
        }
        const passwordHash = await bcrypt.hash(dto.newPassword, 10);
        await this.prisma.user.updateMany({
            where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, { id: auth.userId }),
            data: { passwordHash },
        });
        return { ok: true };
    }
    async list(auth, query) {
        const page = Math.max(1, Number(query?.page || 1));
        const limit = Math.min(100, Math.max(1, Number(query?.limit || 50)));
        const where = (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId);
        const [rows, total] = await Promise.all([
            this.prisma.user.findMany({
                where,
                select: {
                    id: true,
                    name: true,
                    title: true,
                    email: true,
                    role: true,
                    active: true,
                    doctorCode: true,
                    createdAt: true,
                    featureOverrides: true,
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.user.count({ where }),
        ]);
        return {
            items: rows.map((u) => {
                const access = (0, access_matrix_1.mergeFeatureOverrides)(u.role, u.featureOverrides);
                const { featureOverrides: _fo, ...rest } = u;
                return { ...rest, access };
            }),
            meta: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
        };
    }
    async create(auth, dto) {
        const passwordHash = await bcrypt.hash(dto.password, 10);
        const created = await this.prisma.user.create({
            data: {
                id: dto.id,
                tenantId: auth.tenantId,
                name: dto.name,
                title: dto.title,
                email: dto.email.toLowerCase(),
                role: dto.role,
                passwordHash,
                active: true,
                doctorCode: dto.role === 'doctor' ? dto.doctorCode || null : null,
            },
            select: {
                id: true,
                name: true,
                title: true,
                email: true,
                role: true,
                active: true,
                doctorCode: true,
                createdAt: true,
                featureOverrides: true,
            },
        });
        const { featureOverrides: fo, ...rest } = created;
        return {
            ...rest,
            access: (0, access_matrix_1.mergeFeatureOverrides)(created.role, fo),
        };
    }
    async update(auth, id, dto) {
        const existing = await this.prisma.user.findFirst({
            where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, { id }),
            select: { role: true },
        });
        if (!existing)
            throw new common_1.NotFoundException('User not found');
        const nextRole = dto.role ?? existing.role;
        const roleChanged = dto.role !== undefined && dto.role !== existing.role;
        let featureOverrides = undefined;
        if (dto.access === null) {
            featureOverrides = client_1.Prisma.JsonNull;
        }
        else if (dto.access !== undefined) {
            const d = (0, access_matrix_1.diffPartialAccess)(nextRole, dto.access);
            featureOverrides = d === null ? client_1.Prisma.JsonNull : d;
        }
        else if (roleChanged) {
            featureOverrides = client_1.Prisma.JsonNull;
        }
        await this.prisma.user.updateMany({
            where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, { id }),
            data: {
                name: dto.name,
                title: dto.title,
                email: dto.email?.toLowerCase(),
                role: dto.role,
                active: dto.active,
                doctorCode: dto.role === 'doctor'
                    ? (dto.doctorCode ?? undefined)
                    : dto.role
                        ? null
                        : dto.doctorCode,
                ...(featureOverrides !== undefined ? { featureOverrides } : {}),
            },
        });
        const fresh = await this.prisma.user.findFirst({
            where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, { id }),
            select: {
                id: true,
                name: true,
                title: true,
                email: true,
                role: true,
                active: true,
                doctorCode: true,
                createdAt: true,
                featureOverrides: true,
            },
        });
        if (!fresh)
            throw new common_1.NotFoundException('User not found');
        const { featureOverrides: fo, ...rest } = fresh;
        return {
            ...rest,
            access: (0, access_matrix_1.mergeFeatureOverrides)(fresh.role, fo),
        };
    }
    async toggleActive(auth, id) {
        const user = await this.prisma.user.findFirst({ where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, { id }) });
        if (!user)
            return null;
        return this.update(auth, id, { active: !user.active });
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UsersService);
//# sourceMappingURL=users.service.js.map