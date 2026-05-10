import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
type SuccessEnvelope<T> = {
    success: true;
    data: T;
    error: null;
};
export declare class ResponseEnvelopeInterceptor<T> implements NestInterceptor<T, SuccessEnvelope<T> | undefined> {
    intercept(context: ExecutionContext, next: CallHandler): Observable<SuccessEnvelope<T> | undefined>;
}
export {};
