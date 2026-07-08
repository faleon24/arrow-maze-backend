import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';

import { InvalidTokenError } from '../../domain/errors';
import { ITokenService } from '../../application/ports/out/token-service.port';
import { TOKEN_SERVICE } from '../../application/ports/tokens';

/**
 * JwtAuthGuard — the project's authentication/authorisation aspect
 * (AOP). Applied to protected routes with @UseGuards(JwtAuthGuard),
 * it runs BEFORE the controller handler and enforces that a valid
 * Bearer token is present.
 *
 * Responsibilities:
 *   1. Extract the token from the Authorization header.
 *   2. Verify it via the ITokenService port (which returns the
 *      user id, or throws on any failure).
 *   3. Attach the resolved userId to the request object so the
 *      controller can read it without re-parsing the token.
 *
 * This keeps the authentication concern entirely out of the
 * controllers and use cases: a protected handler simply trusts
 * that if it runs at all, the caller is authenticated and
 * request.userId is set. That is the essence of AOP — a
 * cross-cutting concern applied declaratively, in one place.
 *
 * SOLID strategy:
 *  - SRP: the guard only authenticates. It does not load the user
 *    or make business decisions.
 *  - DIP: it depends on the ITokenService abstraction, not on the
 *    JWT library. Swapping token technology needs no change here.
 *
 * On any failure it throws InvalidTokenError, which the global
 * exception filter maps to 401. It never distinguishes "no header"
 * from "bad token" from "expired token" in the response, to avoid
 * leaking information to an attacker.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(TOKEN_SERVICE) private readonly tokens: ITokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearerToken(request);

    if (token === null) {
      throw new InvalidTokenError();
    }

    let userId: string;
    try {
      userId = await this.tokens.verify(token);
    } catch {
      // Any verification failure (malformed, bad signature, expired)
      // collapses to a single generic error. No detail leaks out.
      throw new InvalidTokenError();
    }

    // Attach the authenticated identity for downstream handlers.
    (request as Request & { userId?: string }).userId = userId;
    return true;
  }

  /**
   * Pulls the raw token from an "Authorization: Bearer <token>"
   * header. Returns null if the header is absent or malformed.
   */
  private extractBearerToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (typeof header !== 'string') {
      return null;
    }
    const [scheme, value] = header.split(' ');
    if (scheme !== 'Bearer' || !value || value.trim().length === 0) {
      return null;
    }
    return value.trim();
  }
}