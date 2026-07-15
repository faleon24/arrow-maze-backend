import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

import { DomainError } from '../../domain/errors';
import { EmailAlreadyRegisteredError } from '../../domain/errors/email-already-registered.error';
import { InvalidCredentialsError } from '../../domain/errors/invalid-credentials.error';
import { InvalidTokenError } from '../../domain/errors/invalid-token.error';
import { UnauthorizedError } from '../../domain/errors/unauthorized.error';
import { LevelNotFoundError } from '../../domain/errors/level-not-found.error';

/**
 * Shape of every error response the API produces. A single, stable
 * envelope means clients can rely on one format regardless of which
 * layer or which kind of failure produced the error.
 */
interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string;
  code: string | null;
  timestamp: string;
  path: string;
}

/**
 * DomainExceptionFilter — the API layer's centralised exception
 * handler. Registered globally in main.ts, it intercepts every
 * unhandled exception in the request pipeline and turns it into a
 * consistent HTTP response.
 *
 * This is the project's "Centralised Exception Handling" aspect
 * (AOP). It is a cross-cutting concern: no use case, no domain
 * service, and no controller contains a single try/catch for HTTP
 * error mapping. They throw errors in the language of the domain;
 * this filter — and only this filter — knows how those errors map
 * to status codes and JSON.
 *
 * SOLID strategy:
 *  - OCP: the domain-error -> HTTP-status mapping lives in a Map.
 *    Supporting a new domain error means adding one entry, never
 *    editing the catch logic below.
 *  - SRP: this class only translates exceptions into HTTP
 *    responses. It does not enforce business rules or log domain
 *    events.
 *  - DIP: it discriminates on the DomainError abstraction, not on
 *    a hard-coded list of concrete subclasses in the control flow.
 *
 * @Catch() with no arguments means "catch everything"; we then
 * branch by type inside.
 */
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  /**
   * Maps concrete domain errors to HTTP status codes. This is the
   * single extension point (OCP): new domain errors are registered
   * here without touching catch().
   */
  
private static readonly STATUS_BY_ERROR = new Map<Function, number>([
    [EmailAlreadyRegisteredError, HttpStatus.CONFLICT], // 409
    [InvalidCredentialsError, HttpStatus.UNAUTHORIZED], // 401
    [InvalidTokenError, HttpStatus.UNAUTHORIZED], // 401
    [UnauthorizedError, HttpStatus.UNAUTHORIZED], // 401
    [LevelNotFoundError, HttpStatus.NOT_FOUND], // 404
  ]);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const body = this.buildBody(exception, request.url);

    // Unexpected errors (not domain, not HttpException) are real
    // bugs or infrastructure failures. Log the full detail on the
    // server; never leak it to the client.
    if (body.statusCode === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(body.statusCode).json(body);
  }

  private buildBody(exception: unknown, path: string): ErrorResponseBody {
    const timestamp = new Date().toISOString();

    // 1. Known domain errors -> mapped status + safe message.
    if (exception instanceof DomainError) {
      const status =
        DomainExceptionFilter.STATUS_BY_ERROR.get(exception.constructor) ??
        HttpStatus.BAD_REQUEST;
      return {
        statusCode: status,
        error: HttpStatus[status] ?? 'ERROR',
        message: exception.message,
        code: exception.code,
        timestamp,
        path,
      };
    }

    // 2. Nest HttpException (e.g. ValidationPipe 400, route 404).
    //    Respect the status and message Nest already decided.
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const message =
        typeof res === 'string'
          ? res
          : ((res as Record<string, unknown>).message as
              | string
              | string[]);
      return {
        statusCode: status,
        error: HttpStatus[status] ?? 'ERROR',
        message: Array.isArray(message) ? message.join('; ') : message,
        code: null,
        timestamp,
        path,
      };
    }

    // 3. Anything else -> generic 500. Do not expose internals.
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      code: null,
      timestamp,
      path,
    };
  }
}