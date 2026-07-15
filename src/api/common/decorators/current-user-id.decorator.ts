import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * CurrentUserId — extracts the authenticated user's id from the
 * request. JwtAuthGuard runs first and attaches `userId` to the
 * request; this decorator hides that infrastructure detail from
 * controllers, replacing the triplicated
 *   (request as Request & { userId: string }).userId
 * cast with a typed `@CurrentUserId() userId: string` parameter.
 *
 * Kept intentionally tiny: it does NOT re-validate the token. The
 * guard is the single source of truth for authentication; this
 * decorator only surfaces the identity the guard produced. This is
 * the same separation-of-concerns rationale that motivates the LoggingUseCaseDecorator
 * and DomainExceptionFilter their own aspects: infrastructure noise
 * out of the handler, so the controller body reads like intent.
 */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string =>
    ctx.switchToHttp().getRequest<Request & { userId: string }>().userId,
);