/**
 * PasswordHash value object.
 *
 * Represents a hashed password (never a plaintext one). This class
 * is intentionally agnostic to the specific hashing algorithm — it
 * only enforces basic structural constraints. Algorithm-specific
 * validation belongs in the hasher implementation, not in the VO.
 *
 * SRP: this class only knows about what constitutes a "reasonable
 * hash string" at a structural level. It never hashes or verifies
 * passwords — that responsibility lives behind the IPasswordHasher
 * port in the application layer.
 *
 * Immutability: no setters, no mutation. To "change" a hash,
 * construct a new PasswordHash.
 */
export class PasswordHash {
  private readonly _value: string;

  // Minimum reasonable length for any modern hash output.
  // bcrypt: 60, argon2id: 90+, scrypt: 88+, so 20 is a safe lower bound.
  private static readonly MIN_LENGTH = 20;

  constructor(raw: string) {
    if (typeof raw !== 'string') {
      throw new Error('Password hash must be a string');
    }

    if (raw.length === 0) {
      throw new Error('Password hash cannot be empty');
    }

    if (raw.length < PasswordHash.MIN_LENGTH) {
      throw new Error(
        `Password hash is too short (min ${PasswordHash.MIN_LENGTH} characters)`,
      );
    }

    this._value = raw;
  }

  get value(): string {
    return this._value;
  }

  /**
   * Structural equality: two PasswordHash instances are equal iff
   * their internal string values match exactly.
   */
  equals(other: PasswordHash): boolean {
    if (!(other instanceof PasswordHash)) {
      return false;
    }
    return this._value === other._value;
  }

  /**
   * Explicit non-leaky representation. A password hash should not
   * be logged verbatim in production; toString returns a redacted
   * marker to reduce the chance of accidental exposure.
   */
  toString(): string {
    return '[PasswordHash]';
  }
}