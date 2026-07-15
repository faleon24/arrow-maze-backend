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