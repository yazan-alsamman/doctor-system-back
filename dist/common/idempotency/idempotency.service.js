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
exports.IdempotencyService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const prisma_service_1 = require("../../database/prisma.service");
const stable_json_1 = require("../sync/stable-json");
const DEFAULT_TTL_HOURS = 72;
let IdempotencyService = class IdempotencyService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    requestHash(operation, payload) {
        const material = (0, stable_json_1.stableStringify)({ operation, payload });
        return (0, crypto_1.createHash)('sha256').update(material, 'utf8').digest('hex');
    }
    ttlMs() {
        const h = Number(process.env.IDEMPOTENCY_TTL_HOURS || DEFAULT_TTL_HOURS);
        return Math.max(1, h) * 60 * 60 * 1000;
    }
    async replayOrNull(tenantId, actorUserId, idempotencyKey, hash, requestPath, requestMethod) {
        const row = await this.prisma.idempotencyRecord.findUnique({
            where: {
                tenantId_actorUserId_idempotencyKey: {
                    tenantId,
                    actorUserId,
                    idempotencyKey,
                },
            },
        });
        if (!row)
            return null;
        if (row.expiresAt < new Date()) {
            await this.prisma.idempotencyRecord.delete({ where: { id: row.id } });
            return null;
        }
        if (row.requestHash !== hash) {
            throw new common_1.ConflictException({
                message: 'Idempotency-Key was reused with a different request body',
                code: 'IDEMPOTENCY_CONFLICT',
                status: 409,
            });
        }
        if (row.requestPath !== requestPath || row.requestMethod !== requestMethod) {
            throw new common_1.ConflictException({
                message: 'Idempotency-Key was reused on a different endpoint',
                code: 'IDEMPOTENCY_SCOPE_CONFLICT',
                status: 409,
            });
        }
        return {
            responseStatus: row.responseStatus,
            responseBody: row.responseBody,
        };
    }
    async saveSuccess(tenantId, actorUserId, idempotencyKey, hash, requestPath, requestMethod, responseStatus, responseBody) {
        const expiresAt = new Date(Date.now() + this.ttlMs());
        await this.prisma.idempotencyRecord.create({
            data: {
                tenantId,
                actorUserId,
                idempotencyKey,
                requestHash: hash,
                requestPath,
                requestMethod,
                responseStatus,
                responseBody: responseBody === undefined ? undefined : responseBody,
                expiresAt,
            },
        });
    }
};
exports.IdempotencyService = IdempotencyService;
exports.IdempotencyService = IdempotencyService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], IdempotencyService);
//# sourceMappingURL=idempotency.service.js.map