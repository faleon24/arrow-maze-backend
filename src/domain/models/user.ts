import { Email } from './email';

/**
 * User entity — represents a registered player.
 *
 * This class lives in the domain layer and knows nothing about
 * databases, HTTP, or any framework. Its only responsibility is
 * to keep its own state consistent (SRP).
 *
 * Business rules enforced:
 *   - Email must be a valid Email value object (validation delegated)
 *   - Display name cannot be empty or whitespace-only
 *   - Password hash cannot be empty
 *
 * Note: email format validation is delegated to the Email value object.
 * User does not know how emails are validated — it just holds one.
 */

export interface UserProps {
  id: string;
  email: Email;
  passwordHash: string;
  displayName: string;
  createdAt: Date;
}

export class User {
  private _id: string;
  private _email: Email;
  private _passwordHash: string;
  private _displayName: string;
  private _createdAt: Date;

  constructor(props: UserProps) {
    this.validateEmail(props.email);
    this.validateDisplayName(props.displayName);
    this.validatePasswordHash(props.passwordHash);

    this._id = props.id;
    this._email = props.email;
    this._passwordHash = props.passwordHash;
    this._displayName = props.displayName.trim();
    this._createdAt = props.createdAt;
  }

  // ---------- Getters (read-only access from outside) ----------

  get id(): string {
    return this._id;
  }

  get email(): Email {
    return this._email;
  }

  get passwordHash(): string {
    return this._passwordHash;
  }

  get displayName(): string {
    return this._displayName;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  // ---------- Domain behavior ----------

  /**
   * Change the user's display name. Trims whitespace.
   * Throws if the new name is empty or only whitespace.
   */
  rename(newName: string): void {
    this.validateDisplayName(newName);
    this._displayName = newName.trim();
  }

  // ---------- Private validation helpers ----------

  private validateEmail(email: Email): void {
    if (!(email instanceof Email)) {
      throw new Error('Email must be an Email value object');
    }
  }

  private validateDisplayName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new Error('Display name cannot be empty');
    }
  }

  private validatePasswordHash(hash: string): void {
    if (!hash || hash.length === 0) {
      throw new Error('Password hash cannot be empty');
    }
  }
}