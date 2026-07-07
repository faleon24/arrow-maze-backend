import { DomainError } from './domain-error';

/**
 * Raised when an attempt is made to register a user with an email
 * that already belongs to an existing account.
 *
 * This is a business rule enforced by RegisterUserUseCase, not a
 * database constraint violation. Keeping it as a domain error
 * (rather than letting a Postgres unique-constraint error bubble
 * up) means the rule is expressed in the language of the domain
 * and is independent of the persistence technology.
 */
export class EmailAlreadyRegisteredError extends DomainError {
  readonly code = 'EMAIL_ALREADY_REGISTERED';

  constructor(email: string) {
    super(`An account with the email "${email}" already exists`);
  }
}