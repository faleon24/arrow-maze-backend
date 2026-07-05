import { IClock } from '../../application/ports/out/clock.port';

/**
 * SystemClock — infrastructure adapter for IClock.
 *
 * Trivial implementation that returns the current wall-clock time.
 * All application-layer time reads go through this port; tests use
 * a FixedClock instead, ensuring determinism.
 *
 * Pattern: Adapter (GoF structural pattern).
 */
export class SystemClock implements IClock {
  now(): Date {
    return new Date();
  }
}