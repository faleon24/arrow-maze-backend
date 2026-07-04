/**
 * User entity — represents a registered player.
 *
 * This class lives in the domain layer and knows nothing about
 * databases, HTTP, or any framework. Its only responsibility is
 * to keep its own state consistent (SRP).
 *
 * Business rules enforced:
 *   - Email must have a valid format
 *   - Display name cannot be empty or whitespace-only
 *   - Password hash cannot be empty
 */

export interface UserProps {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  createdAt: Date;
}

export class User {
  private _id: string;
  private _email: string;
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

  get email(): string {
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

  private validateEmail(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
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