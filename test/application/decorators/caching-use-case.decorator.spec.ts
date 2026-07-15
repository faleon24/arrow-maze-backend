import {
  CachingUseCaseDecorator,
  CacheClock,
} from '../../../src/application/decorators/caching-use-case.decorator';
import { UseCase } from '../../../src/application/usecases/use-case';

/**
 * Clock whose time is advanced manually, so TTL expiry can be tested
 * deterministically without any real waiting.
 */
class FakeClock implements CacheClock {
  private current = 0;
  now(): number {
    return this.current;
  }
  advance(ms: number): void {
    this.current += ms;
  }
}

/**
 * Inner use case that counts how many times it actually ran and
 * returns a distinct value each call, so a cache hit (stale value,
 * no extra call) is distinguishable from a miss.
 */
class CountingUseCase implements UseCase<{ id: string }, string> {
  calls = 0;
  async execute(command: { id: string }): Promise<string> {
    this.calls += 1;
    return `${command.id}#${this.calls}`;
  }
}

describe('CachingUseCaseDecorator', () => {
  it('should_call_inner_once_and_serve_cached_result_within_ttl', async () => {
    // Arrange
    const inner = new CountingUseCase();
    const clock = new FakeClock();
    const decorator = new CachingUseCaseDecorator(
      inner,
      1000,
      (c) => c.id,
      clock,
    );
    // Act
    const first = await decorator.execute({ id: 'a' });
    clock.advance(999);
    const second = await decorator.execute({ id: 'a' });
    // Assert
    expect(inner.calls).toBe(1);
    expect(second).toBe(first);
  });

  it('should_call_inner_again_after_ttl_expires', async () => {
    // Arrange
    const inner = new CountingUseCase();
    const clock = new FakeClock();
    const decorator = new CachingUseCaseDecorator(
      inner,
      1000,
      (c) => c.id,
      clock,
    );
    // Act
    const first = await decorator.execute({ id: 'a' });
    clock.advance(1001);
    const second = await decorator.execute({ id: 'a' });
    // Assert
    expect(inner.calls).toBe(2);
    expect(second).not.toBe(first);
  });

  it('should_cache_independently_per_command_key', async () => {
    // Arrange
    const inner = new CountingUseCase();
    const clock = new FakeClock();
    const decorator = new CachingUseCaseDecorator(
      inner,
      1000,
      (c) => c.id,
      clock,
    );
    // Act
    await decorator.execute({ id: 'a' });
    await decorator.execute({ id: 'b' });
    // Assert
    expect(inner.calls).toBe(2);
  });

  it('should_use_json_key_by_default_when_no_key_function_is_given', async () => {
    // Arrange
    const inner = new CountingUseCase();
    const clock = new FakeClock();
    const decorator = new CachingUseCaseDecorator<{ id: string }, string>(
      inner,
      1000,
      undefined,
      clock,
    );
    // Act
    await decorator.execute({ id: 'a' });
    const cached = await decorator.execute({ id: 'a' });
    // Assert
    expect(inner.calls).toBe(1);
    expect(cached).toBe('a#1');
  });
});
