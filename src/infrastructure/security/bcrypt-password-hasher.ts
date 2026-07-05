import * as bcrypt from 'bcrypt';
import { IPasswordHasher } from '../../application/ports/out/password-hasher.port';
import { PasswordHash } from '../../domain/models/password-hash';

/**
 * BcryptPasswordHasher — infrastructure adapter for IPasswordHasher.
 *
 * Adapts the `bcrypt` npm library to the application's port. The
 * application layer knows nothing about bcrypt, cost factors, salts,
 * or hash formats: it only knows that some IPasswordHasher exists.
 *
 * This class is the "how" side of DIP: the application declares WHAT
 * it needs (IPasswordHasher), and this class provides HOW (bcrypt).
 *
 * Pattern: Adapter (GoF structural pattern).
 */
export class BcryptPasswordHasher implements IPasswordHasher {
  private readonly rounds: number;

  /**
   * @param rounds bcrypt cost factor. Higher = slower and more secure.
   *   10 is the sensible default in 2026. Tests may pass a lower value
   *   (e.g. 4) to keep the suite fast.
   */
  constructor(rounds: number = 10) {
    if (!Number.isInteger(rounds) || rounds < 4 || rounds > 15) {
      throw new Error('bcrypt rounds must be an integer between 4 and 15');
    }
    this.rounds = rounds;
  }

  async hash(plaintext: string): Promise<PasswordHash> {
    if (typeof plaintext !== 'string' || plaintext.length === 0) {
      throw new Error('Plaintext password cannot be empty');
    }
    const raw = await bcrypt.hash(plaintext, this.rounds);
    return new PasswordHash(raw);
  }

  async verify(plaintext: string, hash: PasswordHash): Promise<boolean> {
    if (typeof plaintext !== 'string' || plaintext.length === 0) {
      return false;
    }
    return bcrypt.compare(plaintext, hash.value);
  }
}