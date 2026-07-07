import { AuthToken } from '../../../domain/models/auth-token';

/**
 * AuthTokenResponseDto — HTTP response body for successful
 * authentication (register and login).
 *
 * Serializes the AuthToken domain value object into the JSON
 * shape that clients consume: the raw token string and an
 * ISO 8601 timestamp for the expiration.
 *
 * The static `from` factory is a tiny mapper. Keeping it here
 * (rather than in a separate mapper class) is deliberate: the
 * transformation is trivial and lives right next to the shape
 * it produces. If this response ever grows more fields sourced
 * from multiple domain objects, we would extract a dedicated
 * mapper under api/auth/mappers/.
 */
export class AuthTokenResponseDto {
  readonly token: string;
  readonly expiresAt: string;

  private constructor(token: string, expiresAt: string) {
    this.token = token;
    this.expiresAt = expiresAt;
  }

  static from(authToken: AuthToken): AuthTokenResponseDto {
    return new AuthTokenResponseDto(
      authToken.value,
      authToken.expiresAt.toISOString(),
    );
  }
}