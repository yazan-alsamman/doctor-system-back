import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isPrismaInitError = exception instanceof Prisma.PrismaClientInitializationError;
    const isPrismaKnownError = exception instanceof Prisma.PrismaClientKnownRequestError;
    const prismaCode = isPrismaKnownError ? exception.code : undefined;
    const isDatabaseUnavailable = isPrismaInitError || prismaCode === 'P1001' || prismaCode === 'ECONNREFUSED';
    const status = isDatabaseUnavailable
      ? HttpStatus.SERVICE_UNAVAILABLE
      : exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw = isDatabaseUnavailable
      ? {
          message: 'Database is unavailable. Please try again shortly.',
          code: 'DB_UNAVAILABLE',
          status: HttpStatus.SERVICE_UNAVAILABLE,
        }
      : exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error' };

    const message =
      typeof raw === 'string'
        ? raw
        : (raw as { message?: string | string[] })?.message || 'Unexpected error';
    const code =
      typeof raw === 'object' && raw && 'code' in raw
        ? String((raw as { code?: string }).code)
        : status === 500
          ? 'INTERNAL_ERROR'
          : 'REQUEST_ERROR';

    const messageText = Array.isArray(message) ? message.join(', ') : message;
    const stack = exception instanceof Error ? exception.stack : undefined;
    this.logger.error(`${request.method} ${request.url} -> ${status} ${code}: ${messageText}`, stack);

    if (response.headersSent) {
      this.logger.warn(
        `Skipped JSON error body (headers already sent): ${request.method} ${request.url}`,
      );
      return;
    }

    response.status(status).json({
      success: false,
      data: null,
      error: {
        status,
        code,
        message,
      },
    });
  }
}
