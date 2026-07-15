import { IAuthChecker } from '../../application/ports/out/auth-checker.port';

/**
 * PresenceAuthChecker — the default IAuthChecker policy.
 *
 * A subject is authenticated iff it is a non-empty, non-whitespace
 * string. By the time a protected use case runs, the API-layer
 * JwtAuthGuard has already resolved a real user id from a verified
 * token, so in practice the subject is always present; this adapter is
 * the application layer's independent second line of defence, refusing
 * to run a protected use case for a missing or blank subject.
 *
 * Deliberately trivial and free of I/O: richer checks (session lookup,
 * token revocation) would live in a different adapter behind the same
 * IAuthChecker port, chosen at the composition root.
 */
export class PresenceAuthChecker implements IAuthChecker {
  isAuthenticated(subject: string | undefined | null): boolean {
    return typeof subject === 'string' && subject.trim().length > 0;
  }
}
