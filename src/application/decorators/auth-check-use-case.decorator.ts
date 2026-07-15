import { UseCase } from '../usecases/use-case';
import { IAuthChecker } from '../ports/out/auth-checker.port';
import { UnauthorizedError } from '../../domain/errors/unauthorized.error';

/**
 * AuthCheckUseCaseDecorator — an AOP aspect that enforces an
 * authenticated caller before a protected use case runs.
 *
 * It implements the same UseCase<TCommand, TResult> contract as the
 * use case it wraps (Decorator pattern, GoF). Authorization is a
 * cross-cutting concern woven in from the edge: the wrapped use case
 * contains no auth code and cannot be executed for an unauthenticated
 * subject, giving the application layer defence-in-depth independent of
 * the API-layer JwtAuthGuard.
 *
 * The subject is pulled from the command via an injected extractor, so
 * the decorator stays agnostic to each command's shape. Whether that
 * subject counts as authenticated is delegated to the IAuthChecker port
 * (DIP) — the composition root supplies the concrete policy.
 */
export class AuthCheckUseCaseDecorator<TCommand, TResult>
  implements UseCase<TCommand, TResult>
{
  constructor(
    private readonly inner: UseCase<TCommand, TResult>,
    private readonly extractSubject: (
      command: TCommand,
    ) => string | undefined | null,
    private readonly authChecker: IAuthChecker,
  ) {}

  async execute(command: TCommand): Promise<TResult> {
    const subject = this.extractSubject(command);
    if (!this.authChecker.isAuthenticated(subject)) {
      // Reject before touching the inner use case. The decorator
      // guards, it does not execute.
      throw new UnauthorizedError();
    }
    return this.inner.execute(command);
  }
}
