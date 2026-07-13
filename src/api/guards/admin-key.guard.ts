import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * AdminKeyGuard — protects admin-only routes with a shared secret in
 * the X-Admin-Key header, matched against the ADMIN_API_KEY env var.
 *
 * A lightweight guard for internal tooling (creating levels, seeding
 * data). Not a substitute for JwtAuthGuard on player-facing routes —
 * it authenticates a caller as "the operator", not as any user.
 *
 * Comparison walks both strings to the max length so total time
 * depends only on lengths, not on where they first diverge — closes
 * the timing oracle a naive `===` opens. Node's crypto.timingSafeEqual
 * would require equal-length Buffers; the manual loop generalizes
 * across differently-shaped keys without a length-based fast fail.
 *
 * A missing ADMIN_API_KEY at request time throws a plain Error rather
 * than silently allowing every request — refuse to activate admin
 * routes without a configured key.
 */
@Injectable()
export class AdminKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.ADMIN_API_KEY;
    if (!expected) {
      throw new Error(
        'ADMIN_API_KEY is not defined. Refuse to activate admin routes without a configured key.',
      );
    }

    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.header('x-admin-key');

    if (!provided) {
      throw new UnauthorizedException('Admin key missing');
    }

    if (!AdminKeyGuard._timingSafeEqual(provided, expected)) {
      throw new UnauthorizedException('Admin key rejected');
    }

    return true;
  }

  /** Constant-time string equality. */
  private static _timingSafeEqual(a: string, b: string): boolean {
    let mismatch = a.length ^ b.length;
    const max = Math.max(a.length, b.length);
    for (let i = 0; i < max; i++) {
      mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
    }
    return mismatch === 0;
  }
}