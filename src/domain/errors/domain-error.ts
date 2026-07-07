/**
 * DomainError — abstract base for all business-rule violations.
 *
 * Every error that represents a domain condition (as opposed to a
 * programming bug or an infrastructure failure) extends this class.
 * The global exception filter in the API layer uses `instanceof
 * DomainError` to recognise these and map them to appropriate HTTP
 * status codes, while letting unexpected errors fall through to a
 * generic 500.
 *
 * Why a class and not an interface: interfaces are erased at runtime
 * in TypeScript, so `instanceof` would not work. A concrete abstract
 * base gives us runtime type discrimination in the filter.
 *
 * The `code` is a stable, machine-readable identifier (e.g.
 * "EMAIL_ALREADY_REGISTERED"). Unlike the human-readable message,
 * it is safe to expose to clients and safe to branch on. Clients
 * can localise or react to `code` without parsing English prose.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    // Restores the prototype chain, which is broken when extending
    // built-ins like Error under certain TS/JS target settings.
    // Without this, `instanceof` checks can silently fail.
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = new.target.name;
  }
}