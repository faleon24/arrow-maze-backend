/**
 * IRandomSource — abstraction over randomness so tests can inject a
 * seeded RNG and observe deterministic output.
 *
 * The default binding uses Math.random via DefaultRandomSource; specs
 * use SeededRandomSource with a fixed seed so a failing generator
 * output is reproducible.
 */
export interface IRandomSource {
  /** Uniform integer in [0, max). Throws if max <= 0. */
  nextInt(max: number): number;
}

/**
 * DefaultRandomSource — Math.random-backed. Production binding.
 */
export class DefaultRandomSource implements IRandomSource {
  nextInt(max: number): number {
    if (!Number.isInteger(max) || max <= 0) {
      throw new Error(`max must be a positive integer, got ${max}`);
    }
    return Math.floor(Math.random() * max);
  }
}

/**
 * SeededRandomSource — deterministic linear congruential generator
 * for tests. Uses Numerical Recipes constants and Math.imul so 32-bit
 * overflow behaves the same on every JS runtime. Not cryptographically
 * strong; NEVER use in production.
 */
export class SeededRandomSource implements IRandomSource {
  private state: number;

  constructor(seed: number) {
    if (!Number.isInteger(seed)) {
      throw new Error(`seed must be an integer, got ${seed}`);
    }
    this.state = seed >>> 0;
  }

  nextInt(max: number): number {
    if (!Number.isInteger(max) || max <= 0) {
      throw new Error(`max must be a positive integer, got ${max}`);
    }
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state % max;
  }
}
