import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import type { ZodError, ZodSchema } from 'zod';

function formatZodError(error: ZodError): string {
  const flat = error.flatten();
  const parts: string[] = [];
  for (const [field, msgs] of Object.entries(flat.fieldErrors)) {
    if (Array.isArray(msgs) && msgs.length) parts.push(`${field}: ${msgs.join(', ')}`);
  }
  const formErrors = Array.isArray(flat.formErrors) ? flat.formErrors : [];
  if (formErrors.length) parts.push(...formErrors);
  return parts.length ? parts.join('; ') : 'Validation failed';
}

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    // Method-level @UsePipes runs for every parameter (e.g. @CurrentUser(), @Param()).
    // Only validate the HTTP body; leave other arguments unchanged.
    if (metadata.type !== 'body') {
      return value;
    }
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException({
        message: formatZodError(parsed.error),
        code: 'VALIDATION_ERROR',
        status: 400,
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }
}
