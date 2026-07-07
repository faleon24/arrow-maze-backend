import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * LoggingInterceptor — the project's logging/tracing aspect (AOP).
 *
 * Registered globally in main.ts, it wraps EVERY request and logs
 * the HTTP method, path, resulting status code and the elapsed
 * time in milliseconds. Not a single use case, controller or
 * domain service contains a logger call: the tracing concern is
 * fully separated from the business code. That separation is the
 * whole point of AOP.
 *
 * How it differs from the exception filter (the other aspect):
 *  - The filter runs only when something throws.
 *  - This interceptor runs on every request, with a "before" phase
 *    (start the timer) and an "after" phase (log outcome + duration)
 *    hooked onto the response stream via RxJS `tap`.
 *
 * SOLID strategy:
 *  - SRP: it only measures and records. It makes no business
 *    decision and alters no response.
 *  - OCP: new endpoints are traced automatically with zero extra
 *    code, because the interceptor is global.
 *  - DIP: it depends on Nest's Logger abstraction, not on a
 *    hard-coded console.
 *
 * SECURITY: this interceptor deliberately never logs the request
 * body, headers, or query string. Those can contain passwords and
 * bearer tokens. Only non-sensitive routing metadata and timing
 * are recorded — mirroring the redacted toString() used by the
 * sensitive value objects (PasswordHash, AuthToken).
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const { method, url } = request;

    const startedAt = Date.now();

    // "Before" phase: record that the request entered the pipeline.
    this.logger.log(`--> ${method} ${url}`);

    // "After" phase: tap into the response stream to log the
    // outcome once the handler (and everything downstream) resolves.
    return next.handle().pipe(
      tap({
        next: () => {
          const elapsed = Date.now() - startedAt;
          const response = http.getResponse<Response>();
          this.logger.log(
            `<-- ${method} ${url} ${response.statusCode} ${elapsed}ms`,
          );
        },
        error: (err: unknown) => {
          const elapsed = Date.now() - startedAt;
          // The exception filter will set the final status; here we
          // just note that this request ended in an error and how
          // long it took. We log the error's name/message, never a
          // full body or sensitive payload.
          const label =
            err instanceof Error ? `${err.name}: ${err.message}` : 'error';
          this.logger.warn(`<-- ${method} ${url} FAILED (${label}) ${elapsed}ms`);
        },
      }),
    );
  }
}