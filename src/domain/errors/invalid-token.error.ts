import { DomainError } from './domain-error';

/**
 * Raised when an authentication token is missing, malformed,
 * expired, or otherwise fails verification.
 *
 * The JwtAuthGuard throws this when it cannot resolve a valid
 * user id from the incoming Bearer token. The global exception
 * filter maps it to HTTP 401.
 */
export class InvalidTokenError extends DomainError {
  readonly code = 'INVALID_TOKEN';

  constructor() {
    super('Authentication token is missing or invalid');
  }
}