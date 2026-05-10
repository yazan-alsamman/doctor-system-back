import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class DomainEventsService {
  async emitTx(
    tx: Prisma.TransactionClient,
    input: {
      tenantId: string;
      aggregateType: string;
      aggregateId: string;
      eventType: string;
      payload?: Prisma.InputJsonValue;
    },
  ) {
    return tx.domainEvent.create({
      data: {
        tenantId: input.tenantId,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        eventType: input.eventType,
        payload: input.payload,
      },
    });
  }

  async emit(
    prisma: PrismaClient,
    input: {
      tenantId: string;
      aggregateType: string;
      aggregateId: string;
      eventType: string;
      payload?: Prisma.InputJsonValue;
    },
  ) {
    return prisma.domainEvent.create({
      data: {
        tenantId: input.tenantId,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        eventType: input.eventType,
        payload: input.payload,
      },
    });
  }
}
