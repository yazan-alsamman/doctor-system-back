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

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  // Restrict CORS to explicit frontend origins. Never use `origin: true` with credentials.
  const rawOrigins = process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:5174';
  const allowedOrigins = rawOrigins.split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({
    origin: (requestOrigin, callback) => {
      if (!requestOrigin || allowedOrigins.includes(requestOrigin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin '${requestOrigin}' is not allowed by CORS policy`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Idempotency-Key'],
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
