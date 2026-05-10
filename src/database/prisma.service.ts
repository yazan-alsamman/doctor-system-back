import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Prisma 7+ requires a driver adapter for PostgreSQL (`adapter` in client options).
 * Pool tuning + query retry reduce 500s when Postgres drops idle connections (P1017).
 * Reconnects are serialized so parallel JWT validations do not stampede $disconnect/$connect.
 */
function stripPoolUnfriendlyQueryParams(connectionString: string): string {
  const q = connectionString.indexOf('?');
  if (q === -1) return connectionString;
  const base = connectionString.slice(0, q);
  const params = new URLSearchParams(connectionString.slice(q + 1));
  for (const key of [
    'connection_limit',
    'pool_timeout',
    'socket_timeout',
    'max_idle_connection_lifetime',
    'connect_timeout',
  ]) {
    params.delete(key);
  }
  const tail = params.toString();
  return tail ? `${base}?${tail}` : base;
}

function describeDatabaseTarget(rawUrl: string): string {
  try {
    const u = new URL(rawUrl.replace(/^postgres(ql)?:/i, 'http:'));
    const db = u.pathname.replace(/^\//, '') || '(no database)';
    return `${u.hostname}:${u.port || '5432'}/${db}`;
  } catch {
    return '(could not parse DATABASE_URL)';
  }
}

function isTransientConnectionError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const err = e as { code?: string; message?: string };
  if (err.code === 'P1017') return true;
  const msg = String(err.message ?? '');
  if (/Server has closed the connection/i.test(msg)) return true;
  if (/Connection terminated unexpectedly/i.test(msg)) return true;
  return false;
}

/** One reconnect at a time across all concurrent queries. */
let reconnectMutex: Promise<void> = Promise.resolve();

function scheduleReconnect(base: PrismaClient, logger: Logger): Promise<void> {
  reconnectMutex = reconnectMutex.then(async () => {
    logger.warn('PostgreSQL connection unhealthy; recycling pool…');
    try {
      await base.$disconnect();
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 150));
    await base.$connect();
  });
  return reconnectMutex;
}

function createClient(logger: Logger): PrismaClient {
  const connectionString = stripPoolUnfriendlyQueryParams(process.env.DATABASE_URL?.trim() ?? '');
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  const adapter = new PrismaPg(
    {
      connectionString,
      max: 15,
      idleTimeoutMillis: 60_000,
      connectionTimeoutMillis: 15_000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
      maxLifetimeSeconds: 600,
      application_name: 'mediflow-api',
    },
    {
      onPoolError: (err) => logger.error(`PostgreSQL pool error: ${err.message}`, err.stack),
    },
  );

  const base = new PrismaClient({ adapter });

  return base.$extends({
    query: {
      $allModels: {
        async $allOperations(ctx) {
          const maxAttempts = 3;
          for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            try {
              return await ctx.query(ctx.args);
            } catch (e) {
              if (!isTransientConnectionError(e) || attempt === maxAttempts) {
                throw e;
              }
              await scheduleReconnect(base, logger);
            }
          }
        },
      },
    },
  }) as unknown as PrismaClient;
}

/** DI token only — instantiated via `PrismaModule` factory (includes lifecycle hooks on the instance). */
export abstract class PrismaService extends PrismaClient {}

export function createPrismaService(): PrismaService {
  const logger = new Logger('PrismaService');
  const db = createClient(logger);
  const rawUrl = process.env.DATABASE_URL?.trim() ?? '';

  return Object.assign(db, {
    async onModuleInit() {
      const target = describeDatabaseTarget(rawUrl);
      try {
        await db.$connect();
        await db.$queryRaw`SELECT 1`;
        logger.log(`Database connected (${target})`);
        if (/\/template1(\?|$)/i.test(rawUrl)) {
          logger.warn(
            'DATABASE_URL uses database "template1". Use a dedicated database name (e.g. mediflow) for application data.',
          );
        }
      } catch (err) {
        const code =
          err && typeof err === 'object' && 'code' in err ? String((err as NodeJS.ErrnoException).code) : '';
        const hint =
          code === 'ECONNREFUSED'
            ? ' Nothing is listening on that host/port — start PostgreSQL (e.g. from Medi_BackEnd run: docker compose up -d).'
            : '';
        logger.error(
          `Cannot reach PostgreSQL at ${target}.${hint} Verify Medi_BackEnd/.env DATABASE_URL.`,
        );
        throw err;
      }
    },
    async onModuleDestroy() {
      await db.$disconnect();
    },
  }) as PrismaService;
}
