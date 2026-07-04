import { PasswordHash } from '../../../domain/models/password-hash';

/**
 * PasswordHasher outbound port.
 *
 * This interface declares WHAT the application needs
 * ("something that hashes and verifies passwords"), not HOW.
 *
 * The domain and application layers depend on this abstraction;
 * concrete implementations (e.g. BcryptPasswordHasher, ArgonPasswordHasher)
 * live in the infrastructure layer and adapt an external library
 * to this contract.
 *
 * This is DIP (Dependency Inversion Principle) in its purest form:
 * high-level policy (the use cases that register or authenticate
 * users) does not depend on low-level detail (which library
 * computes the hash).
 */
export interface IPasswordHasher {
  /**
   * Compute a hash from a plaintext password.
   * The plaintext should never be persisted or logged.
   */
  hash(plaintext: string): Promise<PasswordHash>;

  /**
   * Verify a plaintext password against a previously computed hash.
   * Returns true if the plaintext matches, false otherwise.
   */
  verify(plaintext: string, hash: PasswordHash): Promise<boolean>;
}