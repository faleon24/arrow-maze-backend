import { DomainError } from './domain-error';

/**
 * Raised when authentication fails, regardless of the underlying
 * cause (unknown email OR wrong password).
 *
 * Security note: the message is intentionally uniform. The caller
 * must NOT be able to tell whether the email was unregistered or
 * the password was wrong — distinguishing them enables user
 * enumeration attacks. LoginUseCase throws this same error for
 * every failure path.
 */
export class InvalidCredentialsError extends DomainError {
  readonly code = 'INVALID_CREDENTIALS';

  constructor() {
    super('Invalid credentials');
  }
}