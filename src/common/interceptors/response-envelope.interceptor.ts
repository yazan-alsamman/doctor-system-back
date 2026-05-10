import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';

type SuccessEnvelope<T> = {
  success: true;
  data: T;
  error: null;
};

@Injectable()
export class ResponseEnvelopeInterceptor<T>
  implements NestInterceptor<T, SuccessEnvelope<T> | undefined>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<SuccessEnvelope<T> | undefined> {
    // Streaming / raw-response handlers use @Res() and manage the response
    // themselves. They return void/undefined — wrapping them would cause NestJS
    // to attempt a second response.send() call which crashes with _header errors.
    const httpCtx = context.switchToHttp();
    const req = httpCtx.getRequest<{ url?: string }>();
    const res = httpCtx.getResponse<{ headersSent?: boolean }>();

    // NDJSON stream sets headers before the handler promise resolves. If we filter on
    // `headersSent`, the observable completes without emitting → Nest's lastValueFrom → EmptyError.
    if (typeof req.url === 'string' && req.url.includes('/ai/copilot/stream')) {
      return next.handle();
    }

    return next.handle().pipe(
      // Drop the emission if headers were already sent (streaming handler)
      filter(() => !res.headersSent),
      map((data) => {
        if (data === undefined || data === null) return undefined as unknown as SuccessEnvelope<T>;
        return {
          success: true as const,
          data,
          error: null,
        };
      }),
      // Drop undefined (void handlers that haven't sent a response yet get skipped)
      filter((v): v is SuccessEnvelope<T> => v !== undefined),
    );
  }
}
