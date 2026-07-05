import { BcryptPasswordHasher } from '../../../src/infrastructure/security/bcrypt-password-hasher';
import { PasswordHash } from '../../../src/domain/models/password-hash';

describe('BcryptPasswordHasher', () => {
  // Use the lowest allowed rounds to keep tests fast.
  // Real bcrypt is still exercised; only the CPU cost is reduced.
  const buildHasher = () => new BcryptPasswordHasher(4);

  // ============================================================
  // Construction
  // ============================================================
  describe('construction', () => {
    it('should_create_hasher_when_rounds_are_in_valid_range', () => {
      // Arrange + Act
      const hasher = new BcryptPasswordHasher(10);

      // Assert
      expect(hasher).toBeInstanceOf(BcryptPasswordHasher);
    });

    it('should_throw_error_when_rounds_are_below_minimum', () => {
      // Act + Assert
      expect(() => new BcryptPasswordHasher(3)).toThrow(
        'bcrypt rounds must be an integer between 4 and 15',
      );
    });

    it('should_throw_error_when_rounds_are_above_maximum', () => {
      // Act + Assert
      expect(() => new BcryptPasswordHasher(16)).toThrow(
        'bcrypt rounds must be an integer between 4 and 15',
      );
    });

    it('should_throw_error_when_rounds_are_not_an_integer', () => {
      // Act + Assert
      expect(() => new BcryptPasswordHasher(10.5)).toThrow(
        'bcrypt rounds must be an integer between 4 and 15',
      );
    });
  });

  // ============================================================
  // Hashing
  // ============================================================
  describe('hash', () => {
    it('should_return_a_password_hash_value_object', async () => {
      // Arrange
      const hasher = buildHasher();

      // Act
      const hash = await hasher.hash('my_secret_password');

      // Assert
      expect(hash).toBeInstanceOf(PasswordHash);
    });

    it('should_never_include_the_plaintext_in_the_hash', async () => {
      // Arrange
      const hasher = buildHasher();
      const plaintext = 'my_secret_password';

      // Act
      const hash = await hasher.hash(plaintext);

      // Assert
      expect(hash.value).not.toContain(plaintext);
    });

    it('should_produce_different_hashes_for_the_same_input_due_to_salt', async () => {
      // Arrange
      const hasher = buildHasher();
      const plaintext = 'my_secret_password';

      // Act
      const hashA = await hasher.hash(plaintext);
      const hashB = await hasher.hash(plaintext);

      // Assert
      expect(hashA.value).not.toBe(hashB.value);
    });

    it('should_throw_error_when_plaintext_is_empty', async () => {
      // Arrange
      const hasher = buildHasher();

      // Act + Assert
      await expect(hasher.hash('')).rejects.toThrow(
        'Plaintext password cannot be empty',
      );
    });
  });

  // ============================================================
  // Verification
  // ============================================================
  describe('verify', () => {
    it('should_return_true_when_plaintext_matches_hash', async () => {
      // Arrange
      const hasher = buildHasher();
      const plaintext = 'my_secret_password';
      const hash = await hasher.hash(plaintext);

      // Act
      const result = await hasher.verify(plaintext, hash);

      // Assert
      expect(result).toBe(true);
    });

    it('should_return_false_when_plaintext_does_not_match_hash', async () => {
      // Arrange
      const hasher = buildHasher();
      const hash = await hasher.hash('correct_password');

      // Act
      const result = await hasher.verify('wrong_password', hash);

      // Assert
      expect(result).toBe(false);
    });

    it('should_return_false_when_plaintext_is_empty', async () => {
      // Arrange
      const hasher = buildHasher();
      const hash = await hasher.hash('some_password');

      // Act
      const result = await hasher.verify('', hash);

      // Assert
      expect(result).toBe(false);
    });
  });

  // ============================================================
  // End-to-end round trip
  // ============================================================
  describe('round trip', () => {
    it('should_allow_verifying_a_password_immediately_after_hashing_it', async () => {
      // Arrange
      const hasher = buildHasher();
      const plaintext = 'round_trip_password_test';

      // Act
      const hash = await hasher.hash(plaintext);
      const verified = await hasher.verify(plaintext, hash);

      // Assert
      expect(verified).toBe(true);
    });
  });
});