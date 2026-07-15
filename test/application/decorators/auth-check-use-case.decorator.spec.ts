import { AuthCheckUseCaseDecorator } from '../../../src/application/decorators/auth-check-use-case.decorator';
import { IAuthChecker } from '../../../src/application/ports/out/auth-checker.port';
import { UnauthorizedError } from '../../../src/domain/errors/unauthorized.error';
import { UseCase } from '../../../src/application/usecases/use-case';

/**
 * Auth checker whose verdict is fixed per test, isolating the
 * decorator's control flow from any real policy.
 */
class FakeAuthChecker implements IAuthChecker {
  constructor(private readonly verdict: boolean) {}
  lastSubject: string | undefined | null = 'unset';
  isAuthenticated(subject: string | undefined | null): boolean {
    this.lastSubject = subject;
    return this.verdict;
  }
}

/**
 * Inner use case that records whether it ran, so tests can prove the
 * decorator short-circuits an unauthorized call.
 */
class SpyUseCase implements UseCase<{ userId: string }, string> {
  ran = false;
  async execute(_command: { userId: string }): Promise<string> {
    this.ran = true;
    return 'inner-result';
  }
}

describe('AuthCheckUseCaseDecorator', () => {
  it('should_execute_inner_and_return_its_result_when_authenticated', async () => {
    // Arrange
    const inner = new SpyUseCase();
    const decorator = new AuthCheckUseCaseDecorator(
      inner,
      (c) => c.userId,
      new FakeAuthChecker(true),
    );
    // Act
    const result = await decorator.execute({ userId: 'u1' });
    // Assert
    expect(inner.ran).toBe(true);
    expect(result).toBe('inner-result');
  });

  it('should_throw_UnauthorizedError_when_not_authenticated', async () => {
    // Arrange
    const inner = new SpyUseCase();
    const decorator = new AuthCheckUseCaseDecorator(
      inner,
      (c) => c.userId,
      new FakeAuthChecker(false),
    );
    // Act + Assert
    await expect(decorator.execute({ userId: '' })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it('should_not_call_inner_when_not_authenticated', async () => {
    // Arrange
    const inner = new SpyUseCase();
    const decorator = new AuthCheckUseCaseDecorator(
      inner,
      (c) => c.userId,
      new FakeAuthChecker(false),
    );
    // Act
    await decorator.execute({ userId: '' }).catch(() => undefined);
    // Assert
    expect(inner.ran).toBe(false);
  });

  it('should_pass_the_extracted_subject_to_the_auth_checker', async () => {
    // Arrange
    const inner = new SpyUseCase();
    const checker = new FakeAuthChecker(true);
    const decorator = new AuthCheckUseCaseDecorator(
      inner,
      (c) => c.userId,
      checker,
    );
    // Act
    await decorator.execute({ userId: 'the-subject' });
    // Assert
    expect(checker.lastSubject).toBe('the-subject');
  });
});
