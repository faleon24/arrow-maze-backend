import { Email } from './email';
import { PasswordHash } from './password-hash';

/**
 * User entity — represents a registered player.
 *
 * This class lives in the domain layer and knows nothing about
 * databases, HTTP, or any framework. Its only responsibility is
 * to keep its own state consistent (SRP).
 *
 * Business rules enforced:
 *   - Email must be a valid Email value object (delegated)
 *   - Password hash must be a valid PasswordHash value object (delegated)
 *   - Display name cannot be empty or whitespace-only
 *
 * All format and structural concerns are delegated to the respective
 * value objects. User only orchestrates their composition.
 */

export interface UserProps {
  id: string;
  email: Email;
  passwordHash: PasswordHash;
  displayName: string;
  createdAt: Date;
}

export class User {
  private _id: string;
  private _email: Email;
  private _passwordHash: PasswordHash;
  private _displayName: string;
  private _createdAt: Date;

  constructor(props: UserProps) {
    this.validateEmail(props.email);
    this.validatePasswordHash(props.passwordHash);
    this.validateDisplayName(props.displayName);

    this._id = props.id;
    this._email = props.email;
    this._passwordHash = props.passwordHash;
    this._displayName = props.displayName.trim();
    this._createdAt = props.createdAt;
  }

  // ---------- Getters ----------

  get id(): string {
    return this._id;
  }

  get email(): Email {
    return this._email;
  }

  get passwordHash(): PasswordHash {
    return this._passwordHash;
  }

  get displayName(): string {
    return this._displayName;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  // ---------- Domain behavior ----------

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

  private validatePasswordHash(hash: PasswordHash): void {
    if (!(hash instanceof PasswordHash)) {
      throw new Error('Password hash must be a PasswordHash value object');
    }
  }

  private validateDisplayName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new Error('Display name cannot be empty');
    }
  }
}