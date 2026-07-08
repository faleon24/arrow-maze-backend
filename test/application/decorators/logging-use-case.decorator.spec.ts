import {
  LoggingUseCaseDecorator,
  UseCaseLogger,
} from '../../../src/application/decorators/logging-use-case.decorator';
import { UseCase } from '../../../src/application/usecases/use-case';

/**
 * Fake logger that records every message it receives, so tests can
 * assert on what was logged (and what was NOT).
 */
class FakeLogger implements UseCaseLogger {
  messages: string[] = [];
  log(message: string): void {
    this.messages.push(message);
  }
}

/**
 * Fake use case that returns a preset result or throws a preset
 * error. Records the command it was given so we can verify the
 * decorator forwards it unchanged.
 */
class FakeUseCase implements UseCase<{ value: string }, string> {
  lastCommand: { value: string } | null = null;
  resultToReturn = 'ok';
  errorToThrow: Error | null = null;

  async execute(command: { value: string }): Promise<string> {
    this.lastCommand = command;
    if (this.errorToThrow !== null) {
      throw this.errorToThrow;
    }
    return this.resultToReturn;
  }
}

describe('LoggingUseCaseDecorator', () => {
  it('should_return_the_wrapped_use_case_result_unchanged_on_success', async () => {
    // Arrange
    const inner = new FakeUseCase();
    inner.resultToReturn = 'the-result';
    const logger = new FakeLogger();
    const decorator = new LoggingUseCaseDecorator(inner, 'FakeUseCase', logger);

    // Act
    const result = await decorator.execute({ value: 'x' });

    // Assert
    expect(result).toBe('the-result');
  });

  it('should_forward_the_command_to_the_wrapped_use_case_unchanged', async () => {
    // Arrange
    const inner = new FakeUseCase();
    const logger = new FakeLogger();
    const decorator = new LoggingUseCaseDecorator(inner, 'FakeUseCase', logger);
    const command = { value: 'payload' };

    // Act
    await decorator.execute(command);

    // Assert
    expect(inner.lastCommand).toBe(command);
  });

  it('should_log_entry_and_exit_on_a_successful_execution', async () => {
    // Arrange
    const inner = new FakeUseCase();
    const logger = new FakeLogger();
    const decorator = new LoggingUseCaseDecorator(inner, 'FakeUseCase', logger);

    // Act
    await decorator.execute({ value: 'x' });

    // Assert
    expect(logger.messages).toHaveLength(2);
    expect(logger.messages[0]).toContain('--> FakeUseCase');
    expect(logger.messages[1]).toContain('<-- FakeUseCase OK');
  });

  it('should_re_throw_the_error_when_the_wrapped_use_case_fails', async () => {
    // Arrange
    const inner = new FakeUseCase();
    const failure = new Error('boom');
    inner.errorToThrow = failure;
    const logger = new FakeLogger();
    const decorator = new LoggingUseCaseDecorator(inner, 'FakeUseCase', logger);

    // Act
    const act = () => decorator.execute({ value: 'x' });

    // Assert — the decorator observes but does not swallow.
    await expect(act).rejects.toBe(failure);
  });

  it('should_log_a_failure_line_with_the_error_type_when_the_use_case_throws', async () => {
    // Arrange
    const inner = new FakeUseCase();
    inner.errorToThrow = new TypeError('bad');
    const logger = new FakeLogger();
    const decorator = new LoggingUseCaseDecorator(inner, 'FakeUseCase', logger);

    // Act
    try {
      await decorator.execute({ value: 'x' });
    } catch {
      // expected
    }

    // Assert
    const failureLine = logger.messages.find((m) => m.includes('FAILED'));
    expect(failureLine).toBeDefined();
    expect(failureLine).toContain('TypeError');
  });

  it('should_not_log_the_command_contents', async () => {
    // Arrange
    const inner = new FakeUseCase();
    const logger = new FakeLogger();
    const decorator = new LoggingUseCaseDecorator(inner, 'FakeUseCase', logger);

    // Act
    await decorator.execute({ value: 'super-secret-password' });

    // Assert — no logged line leaks the command payload.
    const allLogged = logger.messages.join(' ');
    expect(allLogged).not.toContain('super-secret-password');
  });
});