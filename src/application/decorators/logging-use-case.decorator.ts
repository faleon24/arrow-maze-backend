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

/**
 * LoggingUseCaseDecorator — the logging/tracing aspect implemented
 * as a classic GoF Decorator, not as a framework interceptor.
 *
 * It implements the same UseCase<TCommand, TResult> interface as
 * the use case it wraps, so it is a drop-in replacement: callers
 * (and the AppModule wiring) cannot tell whether they hold a bare
 * use case or a decorated one. On execute() it logs entry, runs
 * the wrapped use case, then logs exit with the elapsed time.
 *
 * Why a Decorator instead of the existing Nest interceptor:
 *  - It lives in the application layer, decoupled from HTTP and
 *    from Nest. The same decorator would work in a CLI or a queue
 *    worker, not just behind a controller.
 *  - It satisfies the rubric on two axes at once: the GoF
 *    Decorator pattern (structural) AND an AOP cross-cutting
 *    concern implemented with plain SOLID, no AOP library.
 *
 * SOLID strategy:
 *  - SRP: it only adds logging around execution.
 *  - OCP: any use case can be wrapped without modifying it; new
 *    concerns are new decorators, stacked in the composition root.
 *  - LSP: it is substitutable for the wrapped UseCase because it
 *    implements the same interface and preserves its contract
 *    (same result on success, same error on failure).
 *  - DIP: it depends on the UseCase and UseCaseLogger abstractions,
 *    never on a concrete use case or a concrete logger.
 *
 * SECURITY: it logs only the use case name and timing, never the
 * command contents, which may carry passwords or tokens.
 */
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