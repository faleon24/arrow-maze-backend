import { PasswordHash } from '../../../src/domain/models/password-hash';

describe('PasswordHash', () => {
  // A valid-looking bcrypt-style hash (60 chars). We use it as our
  // canonical example; exact format doesn't matter because PasswordHash
  // is algorithm-agnostic.
  const validRawHash = '$2b$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNO';

  // ============================================================
  // Creation
  // ============================================================
  describe('creation', () => {
    it('should_create_password_hash_when_value_is_valid', () => {
      // Arrange
      const raw = validRawHash;

      // Act
      const hash = new PasswordHash(raw);

      // Assert
      expect(hash.value).toBe(raw);
    });

    it('should_throw_error_when_value_is_empty_string', () => {
      // Arrange
      const raw = '';

      // Act + Assert
      expect(() => new PasswordHash(raw)).toThrow('Password hash cannot be empty');
    });

    it('should_throw_error_when_value_is_shorter_than_min_length', () => {
      // Arrange
      const raw = 'short_hash'; // 10 chars, well below 20

      // Act + Assert
      expect(() => new PasswordHash(raw)).toThrow(/too short/);
    });

    it('should_accept_value_exactly_at_min_length_boundary', () => {
      // Arrange
      const raw = 'a'.repeat(20); // exactly 20 chars

      // Act
      const hash = new PasswordHash(raw);

      // Assert
      expect(hash.value).toBe(raw);
    });
  });

  // ============================================================
  // Equality
  // ============================================================
  describe('equals', () => {
    it('should_return_true_when_two_hashes_have_same_value', () => {
      // Arrange
      const hashA = new PasswordHash(validRawHash);
      const hashB = new PasswordHash(validRawHash);

      // Act
      const result = hashA.equals(hashB);

      // Assert
      expect(result).toBe(true);
    });

    it('should_return_false_when_two_hashes_have_different_values', () => {
      // Arrange
      const hashA = new PasswordHash(validRawHash);
      const hashB = new PasswordHash(
        '$2b$10$DIFFERENTHASHVALUEXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      );

      // Act
      const result = hashA.equals(hashB);

      // Assert
      expect(result).toBe(false);
    });

    it('should_return_false_when_compared_with_non_password_hash_object', () => {
      // Arrange
      const hash = new PasswordHash(validRawHash);
      const notAHash = { value: validRawHash };

      // Act
      // @ts-expect-error -- deliberately passing wrong type
      const result = hash.equals(notAHash);

      // Assert
      expect(result).toBe(false);
    });
  });

  // ============================================================
  // Safe string representation
  // ============================================================
  describe('toString', () => {
    it('should_return_redacted_marker_instead_of_actual_hash', () => {
      // Arrange
      const hash = new PasswordHash(validRawHash);

      // Act
      const result = hash.toString();

      // Assert
      expect(result).toBe('[PasswordHash]');
      expect(result).not.toContain(validRawHash);
    });
  });
});