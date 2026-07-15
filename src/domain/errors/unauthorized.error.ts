import { DomainError } from './domain-error';

/**
 * Raised when a protected use case is invoked without an authenticated
 * subject. Thrown by the AuthCheckUseCaseDecorator when the IAuthChecker
 * policy rejects the caller. The global exception filter maps it to
 * HTTP 401.
 */
export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';
  constructor() {
    super('Authentication is required to perform this action');
  }
}
