import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { AuthContext } from '../../../common/auth-context';
import type { IntentType } from '../intent/intent.types';
import type { CopilotMemorySnapshot } from './copilot-v2.types';

const MEM_PREFIX = 'copilot:mem:v1';
/** Hard cap so one session cannot blow Redis or RAM. */
const MAX_SNAPSHOT_JSON_BYTES = 65_536;
const DEFAULT_TTL_SEC = 86_400;
const MAX_TTL_SEC = 604_800;

/**
 * Short-lived conversational hints (last intent, patient/doctor ids).
 * Uses Redis + TTL when `REDIS_URL` is set; otherwise an in-process Map (single instance only).
 */
@Injectable()
export class CopilotMemoryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CopilotMemoryService.name);
  private readonly local = new Map<string, CopilotMemorySnapshot>();
  private redis: Redis | null = null;
  private readonly ttlSec: number;

  constructor(private readonly config: ConfigService) {
    const raw = this.config.get<string>('COPILOT_MEMORY_TTL_SEC');
    const n = raw != null && raw.trim() ? Number.parseInt(raw.trim(), 10) : NaN;
    if (!Number.isFinite(n) || n < 60) {
      this.ttlSec = DEFAULT_TTL_SEC;
    } else {
      this.ttlSec = Math.min(Math.floor(n), MAX_TTL_SEC);
    }
  }

  async onModuleInit(): Promise<void> {
    const url = this.config.get<string>('REDIS_URL')?.trim();
    if (!url) {
      this.logger.log(
        'Copilot memory: in-process Map (set REDIS_URL for shared TTL-backed storage)',
      );
      return;
    }

    try {
      const client = new Redis(url, {
        lazyConnect: true,
        maxRetriesPerRequest: 2,
      });
      await client.connect();
      this.redis = client;
      this.logger.log(
        `Copilot memory: Redis connected (TTL ${this.ttlSec}s, key prefix ${MEM_PREFIX})`,
      );
    } catch (err) {
      this.logger.error(
        `Copilot memory: Redis connection failed — using in-process Map only: ${String(err).slice(0, 200)}`,
      );
      this.redis = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.quit();
      } catch {
        /* ignore */
      }
      this.redis = null;
    }
  }

  private key(auth: AuthContext, sessionId?: string): string {
    const sid = sessionId?.trim()
      ? `:sess:${this.safeSessionSegment(sessionId)}`
      : '';
    return `${auth.tenantId}:${auth.userId}${sid}`;
  }

  private redisStorageKey(auth: AuthContext, sessionId?: string): string {
    return `${MEM_PREFIX}:${this.key(auth, sessionId)}`;
  }

  /** ASCII-safe session segment for Redis keys */
  private safeSessionSegment(sessionId: string): string {
    const t = sessionId.trim().slice(0, 128);
    const s = t.replace(/[^a-zA-Z0-9_.-]/g, '_');
    return s.length > 0 ? s : 'default';
  }

  async get(
    auth: AuthContext,
    sessionId?: string,
  ): Promise<CopilotMemorySnapshot | undefined> {
    const k = this.key(auth, sessionId);
    if (!this.redis) {
      return this.local.get(k);
    }
    try {
      const raw = await this.redis.get(this.redisStorageKey(auth, sessionId));
      if (!raw) return undefined;
      return this.parseSnapshot(raw);
    } catch (err) {
      this.logger.warn(`memory get: ${String(err).slice(0, 160)}`);
      return undefined;
    }
  }

  async remember(
    auth: AuthContext,
    patch: Partial<Omit<CopilotMemorySnapshot, 'updatedAt'>>,
    sessionId?: string,
  ): Promise<void> {
    const k = this.key(auth, sessionId);
    const prev = (await this.get(auth, sessionId)) ?? undefined;
    const next: CopilotMemorySnapshot = {
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
      await this.redis.set(
        this.redisStorageKey(auth, sessionId),
        payload,
        'EX',
        this.ttlSec,
      );
    } catch (err) {
      this.logger.warn(`memory set: ${String(err).slice(0, 160)}`);
    }
  }

  /** Short prefix for LLM context — optional injection upstream. */
  async formatPromptPrefix(
    auth: AuthContext,
    sessionId?: string,
  ): Promise<string> {
    const m = await this.get(auth, sessionId);
    if (!m) return '';
    const parts: string[] = [];
    if (m.lastPatientId) parts.push(`آخر patientId في المحادثة: ${m.lastPatientId}`);
    if (m.lastDoctorId) parts.push(`آخر doctorId: ${m.lastDoctorId}`);
    if (m.lastIntent) parts.push(`آخر نوع سؤال: ${m.lastIntent}`);
    if (parts.length === 0) return '';
    return `[ذاكرة الجلسة]\n${parts.join('\n')}\n`;
  }

  digestToolsSummary(intent: IntentType, toolNames: string[]): string {
    return `${intent}:${toolNames.join(',')}`;
  }

  private parseSnapshot(raw: string): CopilotMemorySnapshot | undefined {
    try {
      const o = JSON.parse(raw) as CopilotMemorySnapshot;
      if (o && typeof o === 'object' && typeof o.updatedAt === 'number') {
        return o;
      }
    } catch {
      /* drop corrupt payload */
    }
    return undefined;
  }
}
