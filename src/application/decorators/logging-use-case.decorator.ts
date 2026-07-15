import { UseCase } from '../usecases/use-case';

/**
 * Minimal logger contract the decorator depends on. Declaring it
 * here (rather than importing Nest's Logger) keeps the application
 * layer free of framework imports: the composition root injects a
 * concrete logger that satisfies this shape. DIP in action.
 */
export interface UseCaseLogger {
  log(message: string): void;
}

export class LoggingUseCaseDecorator<TCommand, TResult>
  implements UseCase<TCommand, TResult>
{
  constructor(
    private readonly inner: UseCase<TCommand, TResult>,
    private readonly useCaseName: string,
    private readonly logger: UseCaseLogger,
  ) {}

  async execute(command: TCommand): Promise<TResult> {
    const startedAt = Date.now();
    this.logger.log(`[UseCase] --> ${this.useCaseName}`);

    try {
      const result = await this.inner.execute(command);
      const elapsed = Date.now() - startedAt;
      this.logger.log(`[UseCase] <-- ${this.useCaseName} OK ${elapsed}ms`);
      return result;
    } catch (error) {
      const elapsed = Date.now() - startedAt;
      const label =
        error instanceof Error ? error.constructor.name : 'error';
      // Re-throw so the use case's contract (and the exception
      // filter downstream) is preserved. The decorator observes,
      // it does not swallow.
      this.logger.log(
        `[UseCase] <-- ${this.useCaseName} FAILED (${label}) ${elapsed}ms`,
      );
      throw error;
    }
  }
}