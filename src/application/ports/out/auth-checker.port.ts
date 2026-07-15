/**
 * IAuthChecker — outbound port that decides whether a subject
 * (typically a user id resolved from a verified token) counts as an
 * authenticated caller.
 *
 * Declaring it as a port keeps the AuthCheckUseCaseDecorator free of any
 * concrete policy: today the policy is "a non-empty subject is
 * authenticated", but a future adapter could consult a session store,
 * a revocation list, or an identity provider without changing a single
 * line of the decorator. DIP: the application layer depends on this
 * abstraction, never on the implementation.
 */
export interface IAuthChecker {
  isAuthenticated(subject: string | undefined | null): boolean;
}
