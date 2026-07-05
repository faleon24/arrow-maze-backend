import * as jwt from 'jsonwebtoken';
import { ITokenService } from '../../application/ports/out/token-service.port';
import { AuthToken } from '../../domain/models/auth-token';

/**
 * JwtTokenService — infrastructure adapter for ITokenService.
 *
 * Uses the `jsonwebtoken` library (HS256 signing) to issue and
 * verify JWTs. The application layer knows nothing about JWT,
 * algorithms, claims, or signing keys — it only knows that some
 * ITokenService exists.
 *
 * DIP: the application depends on ITokenService (the abstraction);
 * this class provides the JWT-specific "how". Migrating to PASETO
 * or opaque tokens tomorrow means writing a new adapter and swapping
 * the wiring — no changes to use cases or entities.
 *
 * Pattern: Adapter (GoF structural pattern).
 */
export class JwtTokenService implements ITokenService {
  private readonly secret: string;
  private readonly expiresInSeconds: number;

  /**
   * @param secret HMAC signing key. Must be a non-empty string.
   *   Provided from the environment (JWT_SECRET) in production.
   * @param expiresInSeconds token lifetime in seconds. Default: 7 days.
   */
  constructor(secret: string, expiresInSeconds: number = 60 * 60 * 24 * 7) {
    if (typeof secret !== 'string' || secret.length === 0) {
      throw new Error('JWT secret cannot be empty');
    }
    if (!Number.isInteger(expiresInSeconds) || expiresInSeconds <= 0) {
      throw new Error('JWT expiresInSeconds must be a positive integer');
    }
    this.secret = secret;
    this.expiresInSeconds = expiresInSeconds;
  }

  async issue(userId: string): Promise<AuthToken> {
    if (typeof userId !== 'string' || userId.length === 0) {
      throw new Error('userId cannot be empty');
    }

    const raw = jwt.sign({ sub: userId }, this.secret, {
      algorithm: 'HS256',
      expiresIn: this.expiresInSeconds,
    });

    const expiresAt = new Date(Date.now() + this.expiresInSeconds * 1000);
    return new AuthToken(raw, expiresAt);
  }

  async verify(rawToken: string): Promise<string> {
    if (typeof rawToken !== 'string' || rawToken.length === 0) {
      throw new Error('Invalid token');
    }

    let payload: jwt.JwtPayload | string;
    try {
      payload = jwt.verify(rawToken, this.secret, { algorithms: ['HS256'] });
    } catch {
      throw new Error('Invalid token');
    }

    if (typeof payload === 'string' || typeof payload.sub !== 'string') {
      throw new Error('Invalid token');
    }

    return payload.sub;
  }
}