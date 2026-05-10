"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaService = void 0;
exports.createPrismaService = createPrismaService;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
function stripPoolUnfriendlyQueryParams(connectionString) {
    const q = connectionString.indexOf('?');
    if (q === -1)
        return connectionString;
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
function describeDatabaseTarget(rawUrl) {
    try {
        const u = new URL(rawUrl.replace(/^postgres(ql)?:/i, 'http:'));
        const db = u.pathname.replace(/^\//, '') || '(no database)';
        return `${u.hostname}:${u.port || '5432'}/${db}`;
    }
    catch {
        return '(could not parse DATABASE_URL)';
    }
}
function isTransientConnectionError(e) {
    if (!e || typeof e !== 'object')
        return false;
    const err = e;
    if (err.code === 'P1017')
        return true;
    const msg = String(err.message ?? '');
    if (/Server has closed the connection/i.test(msg))
        return true;
    if (/Connection terminated unexpectedly/i.test(msg))
        return true;
    return false;
}
let reconnectMutex = Promise.resolve();
function scheduleReconnect(base, logger) {
    reconnectMutex = reconnectMutex.then(async () => {
        logger.warn('PostgreSQL connection unhealthy; recycling pool…');
        try {
            await base.$disconnect();
        }
        catch {
        }
        await new Promise((r) => setTimeout(r, 150));
        await base.$connect();
    });
    return reconnectMutex;
}
function createClient(logger) {
    const connectionString = stripPoolUnfriendlyQueryParams(process.env.DATABASE_URL?.trim() ?? '');
    if (!connectionString) {
        throw new Error('DATABASE_URL is required');
    }
    const adapter = new adapter_pg_1.PrismaPg({
        connectionString,
        max: 15,
        idleTimeoutMillis: 60_000,
        connectionTimeoutMillis: 15_000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10_000,
        maxLifetimeSeconds: 600,
        application_name: 'mediflow-api',
    }, {
        onPoolError: (err) => logger.error(`PostgreSQL pool error: ${err.message}`, err.stack),
    });
    const base = new client_1.PrismaClient({ adapter });
    return base.$extends({
        query: {
            $allModels: {
                async $allOperations(ctx) {
                    const maxAttempts = 3;
                    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
                        try {
                            return await ctx.query(ctx.args);
                        }
                        catch (e) {
                            if (!isTransientConnectionError(e) || attempt === maxAttempts) {
                                throw e;
                            }
                            await scheduleReconnect(base, logger);
                        }
                    }
                },
            },
        },
    });
}
class PrismaService extends client_1.PrismaClient {
}
exports.PrismaService = PrismaService;
function createPrismaService() {
    const logger = new common_1.Logger('PrismaService');
    const db = createClient(logger);
    const rawUrl = process.env.DATABASE_URL?.trim() ?? '';
    return Object.assign(db, {
        async onModuleInit() {
            const target = describeDatabaseTarget(rawUrl);
            try {
                await db.$connect();
                await db.$queryRaw `SELECT 1`;
                logger.log(`Database connected (${target})`);
                if (/\/template1(\?|$)/i.test(rawUrl)) {
                    logger.warn('DATABASE_URL uses database "template1". Use a dedicated database name (e.g. mediflow) for application data.');
                }
            }
            catch (err) {
                const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
                const hint = code === 'ECONNREFUSED'
                    ? ' Nothing is listening on that host/port — start PostgreSQL (e.g. from Medi_BackEnd run: docker compose up -d).'
                    : '';
                logger.error(`Cannot reach PostgreSQL at ${target}.${hint} Verify Medi_BackEnd/.env DATABASE_URL.`);
                throw err;
            }
        },
        async onModuleDestroy() {
            await db.$disconnect();
        },
    });
}
//# sourceMappingURL=prisma.service.js.map