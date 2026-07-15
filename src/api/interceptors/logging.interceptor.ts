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