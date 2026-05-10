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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var CopilotMemoryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopilotMemoryService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ioredis_1 = __importDefault(require("ioredis"));
const MEM_PREFIX = 'copilot:mem:v1';
const MAX_SNAPSHOT_JSON_BYTES = 65_536;
const DEFAULT_TTL_SEC = 86_400;
const MAX_TTL_SEC = 604_800;
let CopilotMemoryService = CopilotMemoryService_1 = class CopilotMemoryService {
    config;
    logger = new common_1.Logger(CopilotMemoryService_1.name);
    local = new Map();
    redis = null;
    ttlSec;
    constructor(config) {
        this.config = config;
        const raw = this.config.get('COPILOT_MEMORY_TTL_SEC');
        const n = raw != null && raw.trim() ? Number.parseInt(raw.trim(), 10) : NaN;
        if (!Number.isFinite(n) || n < 60) {
            this.ttlSec = DEFAULT_TTL_SEC;
        }
        else {
            this.ttlSec = Math.min(Math.floor(n), MAX_TTL_SEC);
        }
    }
    async onModuleInit() {
        const url = this.config.get('REDIS_URL')?.trim();
        if (!url) {
            this.logger.log('Copilot memory: in-process Map (set REDIS_URL for shared TTL-backed storage)');
            return;
        }
        try {
            const client = new ioredis_1.default(url, {
                lazyConnect: true,
                maxRetriesPerRequest: 2,
            });
            await client.connect();
            this.redis = client;
            this.logger.log(`Copilot memory: Redis connected (TTL ${this.ttlSec}s, key prefix ${MEM_PREFIX})`);
        }
        catch (err) {
            this.logger.error(`Copilot memory: Redis connection failed — using in-process Map only: ${String(err).slice(0, 200)}`);
            this.redis = null;
        }
    }
    async onModuleDestroy() {
        if (this.redis) {
            try {
                await this.redis.quit();
            }
            catch {
            }
            this.redis = null;
        }
    }
    key(auth, sessionId) {
        const sid = sessionId?.trim()
            ? `:sess:${this.safeSessionSegment(sessionId)}`
            : '';
        return `${auth.tenantId}:${auth.userId}${sid}`;
    }
    redisStorageKey(auth, sessionId) {
        return `${MEM_PREFIX}:${this.key(auth, sessionId)}`;
    }
    safeSessionSegment(sessionId) {
        const t = sessionId.trim().slice(0, 128);
        const s = t.replace(/[^a-zA-Z0-9_.-]/g, '_');
        return s.length > 0 ? s : 'default';
    }
    async get(auth, sessionId) {
        const k = this.key(auth, sessionId);
        if (!this.redis) {
            return this.local.get(k);
        }
        try {
            const raw = await this.redis.get(this.redisStorageKey(auth, sessionId));
            if (!raw)
                return undefined;
            return this.parseSnapshot(raw);
        }
        catch (err) {
            this.logger.warn(`memory get: ${String(err).slice(0, 160)}`);
            return undefined;
        }
    }
    async remember(auth, patch, sessionId) {
        const k = this.key(auth, sessionId);
        const prev = (await this.get(auth, sessionId)) ?? undefined;
        const next = {
            ...prev,
            ...patch,
            updatedAt: Date.now(),
        };
        const payload = JSON.stringify(next);
        if (Buffer.byteLength(payload, 'utf8') > MAX_SNAPSHOT_JSON_BYTES) {
            this.logger.warn('Copilot memory snapshot too large; skipping persist');
            return;
        }
        if (!this.redis) {
            this.local.set(k, next);
            return;
        }
        try {
            await this.redis.set(this.redisStorageKey(auth, sessionId), payload, 'EX', this.ttlSec);
        }
        catch (err) {
            this.logger.warn(`memory set: ${String(err).slice(0, 160)}`);
        }
    }
    async formatPromptPrefix(auth, sessionId) {
        const m = await this.get(auth, sessionId);
        if (!m)
            return '';
        const parts = [];
        if (m.lastPatientId)
            parts.push(`آخر patientId في المحادثة: ${m.lastPatientId}`);
        if (m.lastDoctorId)
            parts.push(`آخر doctorId: ${m.lastDoctorId}`);
        if (m.lastIntent)
            parts.push(`آخر نوع سؤال: ${m.lastIntent}`);
        if (parts.length === 0)
            return '';
        return `[ذاكرة الجلسة]\n${parts.join('\n')}\n`;
    }
    digestToolsSummary(intent, toolNames) {
        return `${intent}:${toolNames.join(',')}`;
    }
    parseSnapshot(raw) {
        try {
            const o = JSON.parse(raw);
            if (o && typeof o === 'object' && typeof o.updatedAt === 'number') {
                return o;
            }
        }
        catch {
        }
        return undefined;
    }
};
exports.CopilotMemoryService = CopilotMemoryService;
exports.CopilotMemoryService = CopilotMemoryService = CopilotMemoryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], CopilotMemoryService);
//# sourceMappingURL=copilot-memory.service.js.map