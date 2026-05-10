import type { Prisma } from '@prisma/client';
import type { SeedConfig } from './types';

/** Shared transactional context for staged seeds (extend when splitting mega-transactions). */
export interface SeedEngineContext {
  prisma: Prisma.TransactionClient;
  config: SeedConfig;
}
