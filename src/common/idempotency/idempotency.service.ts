import { ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { stableStringify } from '../sync/stable-json';

export type IdempotentReplay<T = unknown> = {
  responseStatus: number;
  responseBody: T;
};

const DEFAULT_TTL_HOURS = 72;

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  requestHash(operation: string, payload: unknown): string {
    const material = stableStringify({ operation, payload });
    return createHash('sha256').update(material, 'utf8').digest('hex');
  }

  private ttlMs(): number {
    const h = Number(process.env.IDEMPOTENCY_TTL_HOURS || DEFAULT_TTL_HOURS);
    return Math.max(1, h) * 60 * 60 * 1000;
  }

  /**
   * Returns cached replay when key exists with same hash; throws if key reused with different body.
   */
  async replayOrNull<T = unknown>(
    tenantId: string,
    actorUserId: string,
    idempotencyKey: string,
    hash: string,
    requestPath: string,
    requestMethod: string,
  ): Promise<IdempotentReplay<T> | null> {
    const row = await this.prisma.idempotencyRecord.findUnique({
      where: {
        tenantId_actorUserId_idempotencyKey: {
          tenantId,
          actorUserId,
          idempotencyKey,
        },
      },
    });
    if (!row) return null;
    if (row.expiresAt < new Date()) {
      await this.prisma.idempotencyRecord.delete({ where: { id: row.id } });
      return null;
    }
    if (row.requestHash !== hash) {
      throw new ConflictException({
        message: 'Idempotency-Key was reused with a different request body',
        code: 'IDEMPOTENCY_CONFLICT',
        status: 409,
      });
    }
    if (row.requestPath !== requestPath || row.requestMethod !== requestMethod) {
      throw new ConflictException({
        message: 'Idempotency-Key was reused on a different endpoint',
        code: 'IDEMPOTENCY_SCOPE_CONFLICT',
        status: 409,
      });
    }
    return {
      responseStatus: row.responseStatus,
      responseBody: row.responseBody as T,
    };
  }

  async saveSuccess<T = unknown>(
    tenantId: string,
    actorUserId: string,
    idempotencyKey: string,
    hash: string,
    requestPath: string,
    requestMethod: string,
    responseStatus: number,
    responseBody: T,
  ): Promise<void> {
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
        responseBody: responseBody === undefined ? undefined : (responseBody as object),
        expiresAt,
      },
    });
  }
}
