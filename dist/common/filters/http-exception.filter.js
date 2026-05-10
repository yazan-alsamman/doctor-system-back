"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var HttpErrorFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpErrorFilter = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
let HttpErrorFilter = HttpErrorFilter_1 = class HttpErrorFilter {
    logger = new common_1.Logger(HttpErrorFilter_1.name);
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        const isPrismaInitError = exception instanceof client_1.Prisma.PrismaClientInitializationError;
        const isPrismaKnownError = exception instanceof client_1.Prisma.PrismaClientKnownRequestError;
        const prismaCode = isPrismaKnownError ? exception.code : undefined;
        const isDatabaseUnavailable = isPrismaInitError || prismaCode === 'P1001' || prismaCode === 'ECONNREFUSED';
        const status = isDatabaseUnavailable
            ? common_1.HttpStatus.SERVICE_UNAVAILABLE
            : exception instanceof common_1.HttpException
                ? exception.getStatus()
                : common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        const raw = isDatabaseUnavailable
            ? {
                message: 'Database is unavailable. Please try again shortly.',
                code: 'DB_UNAVAILABLE',
                status: common_1.HttpStatus.SERVICE_UNAVAILABLE,
            }
            : exception instanceof common_1.HttpException
                ? exception.getResponse()
                : { message: 'Internal server error' };
        const message = typeof raw === 'string'
            ? raw
            : raw?.message || 'Unexpected error';
        const code = typeof raw === 'object' && raw && 'code' in raw
            ? String(raw.code)
            : status === 500
                ? 'INTERNAL_ERROR'
                : 'REQUEST_ERROR';
        const messageText = Array.isArray(message) ? message.join(', ') : message;
        const stack = exception instanceof Error ? exception.stack : undefined;
        this.logger.error(`${request.method} ${request.url} -> ${status} ${code}: ${messageText}`, stack);
        if (response.headersSent) {
            this.logger.warn(`Skipped JSON error body (headers already sent): ${request.method} ${request.url}`);
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
};
exports.HttpErrorFilter = HttpErrorFilter;
exports.HttpErrorFilter = HttpErrorFilter = HttpErrorFilter_1 = __decorate([
    (0, common_1.Catch)()
], HttpErrorFilter);
//# sourceMappingURL=http-exception.filter.js.map