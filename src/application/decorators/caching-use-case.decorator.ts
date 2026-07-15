import { UseCase } from '../usecases/use-case';

/**
 * Minimal time source the caching decorator depends on. Declaring it
 * here (instead of reaching for Date.now() directly) keeps the
 * application layer pure and, crucially, makes TTL expiry testable:
 * a unit test can inject a fake clock and advance time deterministically
 * without sleeping. DIP applied to the passage of time itself.
 */
export interface CacheClock {
  now(): number;
}

/**
 * CachingUseCaseDecorator — an AOP aspect that memoises the result of
 * a use case for a fixed time-to-live, keyed by its command.
 *
 * Like every decorator in this project it implements the same
 * UseCase<TCommand, TResult> contract as the thing it wraps, so the
 * caller cannot tell a cached use case from a bare one — that is the
 * Decorator pattern (GoF, structural). Caching is a cross-cutting
 * concern: the wrapped use case knows nothing about it and contains
 * not a single line of cache code.
 *
 * Only safe to apply to read-only, referentially-transparent use cases
 * whose data changes slowly (e.g. a static catalog). The composition
 * root decides where that holds.
 */
export class CachingUseCaseDecorator<TCommand, TResult>
  implements UseCase<TCommand, TResult>
{
  private readonly store = new Map<
    string,
    { value: TResult; expiresAt: number }
  >();

  constructor(
    private readonly inner: UseCase<TCommand, TResult>,
    private readonly ttlMs: number,
    private readonly keyOf: (command: TCommand) => string = (command) =>
      JSON.stringify(command ?? null),
    private readonly clock: CacheClock = { now: () => Date.now() },
  ) {}

  async execute(command: TCommand): Promise<TResult> {
    const key = this.keyOf(command);
    const now = this.clock.now();

    const hit = this.store.get(key);
    if (hit && hit.expiresAt > now) {
      return hit.value;
    }

    const value = await this.inner.execute(command);
    this.store.set(key, { value, expiresAt: now + this.ttlMs });
    return value;
  }
}
