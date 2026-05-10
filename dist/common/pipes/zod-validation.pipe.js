"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZodValidationPipe = void 0;
const common_1 = require("@nestjs/common");
function formatZodError(error) {
    const flat = error.flatten();
    const parts = [];
    for (const [field, msgs] of Object.entries(flat.fieldErrors)) {
        if (Array.isArray(msgs) && msgs.length)
            parts.push(`${field}: ${msgs.join(', ')}`);
    }
    const formErrors = Array.isArray(flat.formErrors) ? flat.formErrors : [];
    if (formErrors.length)
        parts.push(...formErrors);
    return parts.length ? parts.join('; ') : 'Validation failed';
}
let ZodValidationPipe = class ZodValidationPipe {
    schema;
    constructor(schema) {
        this.schema = schema;
    }
    transform(value, metadata) {
        if (metadata.type !== 'body') {
            return value;
        }
        const parsed = this.schema.safeParse(value);
        if (!parsed.success) {
            throw new common_1.BadRequestException({
                message: formatZodError(parsed.error),
                code: 'VALIDATION_ERROR',
                status: 400,
                details: parsed.error.flatten(),
            });
        }
        return parsed.data;
    }
};
exports.ZodValidationPipe = ZodValidationPipe;
exports.ZodValidationPipe = ZodValidationPipe = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [Function])
], ZodValidationPipe);
//# sourceMappingURL=zod-validation.pipe.js.map