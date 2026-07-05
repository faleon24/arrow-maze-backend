/**
 * Clock outbound port.
 *
 * Declares a single operation: "give me the current instant".
 * Use cases inject this port instead of calling `new Date()`
 * directly, which makes time-dependent logic fully deterministic
 * under test.
 *
 * DIP: the use cases depend on this abstraction. Production code
 * provides SystemClock; tests provide a FixedClock that returns
 * a predetermined value.
 */
export interface IClock {
  now(): Date;
}