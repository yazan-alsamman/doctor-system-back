import { existsSync } from 'fs';
import { config as loadEnvFile } from 'dotenv';
import { resolve } from 'path';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpErrorFilter } from './common/filters/http-exception.filter';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';

const backendRoot = resolve(__dirname, '..');
for (const name of ['.env', '.env.local'] as const) {
  const envPath = resolve(backendRoot, name);
  if (existsSync(envPath)) {
    loadEnvFile({ path: envPath, override: name === '.env.local' });
  }
}

function errnoOf(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'code' in err) {
    return String((err as NodeJS.ErrnoException).code);
  }
  return undefined;
}

/** Split comma-separated origin lists from env (hPanel / .env). */
function parseCommaSeparatedOrigins(...values: (string | undefined)[]): string[] {
  const origins: string[] = [];
  for (const v of values) {
    if (!v) continue;
    for (const part of v.split(',')) {
      const t = part.trim();
      if (t) origins.push(t);
    }
  }
  return origins;
}

/**
 * Allowed browser origins for CORS. Merges hPanel variables with safe defaults:
 * - `CORS_ORIGINS` and `FRONTEND_ORIGINS` (same names work in Hostinger hPanel).
 * - Local Vite + production SPA (grey vs gray subdomain spelling).
 */
function buildAllowedCorsOrigins(): string[] {
  const fromEnv = parseCommaSeparatedOrigins(
    process.env.CORS_ORIGINS,
    process.env.FRONTEND_ORIGINS,
  );
  const builtIn = [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://lightslategrey-hamster-508054.hostingersite.com',
    'https://lightslategray-hamster-508054.hostingersite.com',
  ];
  return [...new Set([...fromEnv, ...builtIn])];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  // Static allowlist (no origin callback errors) — required for credentialed / JSON preflights.
  const allowedOrigins = buildAllowedCorsOrigins();
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Tenant-Id',
      'Idempotency-Key',
      'X-Idempotency-Key',
    ],
  });
  app.useGlobalFilters(new HttpErrorFilter());
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());

  const preferred = Number(process.env.PORT) || 3000;
  const maxAttempts = Math.max(1, Math.min(50, Number(process.env.PORT_FALLBACK_ATTEMPTS) || 15));
  const logger = new Logger('Bootstrap');

  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const port = preferred + attempt;
    try {
      await app.listen(port);
      process.env.PORT = String(port);
      logger.log(`MediFlow API listening on http://localhost:${port}/api`);
      if (port !== preferred) {
        logger.warn(
          `Port ${preferred} was busy (another backend?). Using ${port}. Update mediflow .env VITE_API_BASE_URL or set PORT=${port} here.`,
        );
      }
      return;
    } catch (err: unknown) {
      lastError = err;
      if (errnoOf(err) === 'EADDRINUSE' && attempt < maxAttempts - 1) {
        logger.warn(`Port ${port} in use (${errnoOf(err)}), trying ${port + 1}...`);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}
bootstrap();
