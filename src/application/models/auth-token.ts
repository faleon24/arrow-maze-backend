/**
 * AuthToken value object.
 *
 * Represents an issued authentication token, together with its
 * expiration timestamp. This VO carries no knowledge of how the
 * token was produced (JWT, PASETO, opaque tokens, ...).
 *
 * SRP: it only knows what constitutes "a token with an expiration".
 * Issuance and verification live behind the ITokenService port.
 *
 * Immutability: once created, value and expiration cannot change.
 * A "refreshed" token is a new AuthToken.
 */
export class AuthToken {
  private readonly _value: string;
  private readonly _expiresAt: Date;

  constructor(value: string, expiresAt: Date) {
    if (typeof value !== 'string') {
      throw new Error('Token value must be a string');
    }
    if (value.trim().length === 0) {
      throw new Error('Token value cannot be empty');
    }
    if (!(expiresAt instanceof Date) || isNaN(expiresAt.getTime())) {
      throw new Error('Token expiration must be a valid Date');
    }

    this._value = value;
    this._expiresAt = expiresAt;
  }

  get value(): string {
    return this._value;
  }

  get expiresAt(): Date {
    return this._expiresAt;
  }

  /**
   * True if the token has already expired relative to the given
   * moment. Defaults to "now" if no reference is passed.
   *
   * Passing `now` explicitly is preferred in domain services and
   * use cases (via an IClock port) so the check remains testable
   * without depending on the system clock.
   */
  isExpired(now: Date = new Date()): boolean {
    return this._expiresAt.getTime() <= now.getTime();
  }

  /**
   * Redacted representation. Never leak the raw token in logs.
   */
  toString(): string {
    return '[AuthToken]';
  }
}