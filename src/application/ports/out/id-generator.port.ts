/**
 * IdGenerator outbound port.
 *
 * Declares a single operation: "generate a unique identifier".
 * Use cases inject this port instead of importing a UUID library
 * directly, keeping the application layer library-agnostic and
 * fully testable.
 *
 * Production implementations wrap a real UUID library.
 * Test implementations return predetermined ids so assertions
 * can compare against known values.
 */
export interface IIdGenerator {
  generate(): string;
}