/**
 * Email value object.
 *
 * Represents a validated email address. Once constructed, the value
 * is guaranteed to be well-formed and normalized (lowercase, trimmed).
 * Two Email instances are equal if their normalized values match.
 *
 * Immutability: no setters, no mutation methods. To "change" an email,
 * you create a new Email instance.
 *
 * SRP: this class knows about email validation and normalization,
 * nothing else. Entities that hold an email delegate all format
 * concerns to this class.
 */
export class Email {
  private readonly _value: string;

  constructor(raw: string) {
    if (typeof raw !== 'string') {
      throw new Error('Email must be a string');
    }

    const normalized = raw.trim().toLowerCase();

    if (normalized.length === 0) {
      throw new Error('Email cannot be empty');
    }

    if (!Email.isValidFormat(normalized)) {
      throw new Error('Invalid email format');
    }

    this._value = normalized;
  }

  get value(): string {
    return this._value;
  }

  /**
   * Structural equality: two Emails are equal iff their normalized
   * values match. This is the defining property of a Value Object.
   */
  equals(other: Email): boolean {
    if (!(other instanceof Email)) {
      return false;
    }
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }

  // ---------- Private helpers ----------

  private static isValidFormat(email: string): boolean {
    // Basic RFC-ish check: something@something.something
    // Full RFC 5322 is impractical; this covers all common real-world cases.
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}