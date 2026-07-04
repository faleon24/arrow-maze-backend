import { AuthToken } from '../../../src/domain/models/auth-token';

describe('AuthToken', () => {
  const validValue = 'jwt.header.payload.signature';
  const futureDate = new Date('2099-01-01T00:00:00Z');
  const pastDate = new Date('2000-01-01T00:00:00Z');

  // ============================================================
  // Creation
  // ============================================================
  describe('creation', () => {
    it('should_create_token_when_value_and_expiration_are_valid', () => {
      // Arrange + Act
      const token = new AuthToken(validValue, futureDate);

      // Assert
      expect(token.value).toBe(validValue);
      expect(token.expiresAt).toEqual(futureDate);
    });

    it('should_throw_error_when_value_is_empty', () => {
      // Act + Assert
      expect(() => new AuthToken('', futureDate)).toThrow(
        'Token value cannot be empty',
      );
    });

    it('should_throw_error_when_value_is_only_whitespace', () => {
      // Act + Assert
      expect(() => new AuthToken('   ', futureDate)).toThrow(
        'Token value cannot be empty',
      );
    });

    it('should_throw_error_when_expiration_is_not_a_date', () => {
      // Arrange
      const notADate = 'tomorrow' as unknown as Date;

      // Act + Assert
      expect(() => new AuthToken(validValue, notADate)).toThrow(
        'Token expiration must be a valid Date',
      );
    });

    it('should_throw_error_when_expiration_is_an_invalid_date', () => {
      // Arrange
      const invalidDate = new Date('not-a-real-date');

      // Act + Assert
      expect(() => new AuthToken(validValue, invalidDate)).toThrow(
        'Token expiration must be a valid Date',
      );
    });
  });

  // ============================================================
  // Expiration checks
  // ============================================================
  describe('isExpired', () => {
    it('should_return_false_when_expiration_is_in_the_future', () => {
      // Arrange
      const token = new AuthToken(validValue, futureDate);
      const now = new Date('2026-01-01T00:00:00Z');

      // Act
      const result = token.isExpired(now);

      // Assert
      expect(result).toBe(false);
    });

    it('should_return_true_when_expiration_is_in_the_past', () => {
      // Arrange
      const token = new AuthToken(validValue, pastDate);
      const now = new Date('2026-01-01T00:00:00Z');

      // Act
      const result = token.isExpired(now);

      // Assert
      expect(result).toBe(true);
    });

    it('should_return_true_when_expiration_is_exactly_now', () => {
      // Arrange
      const boundary = new Date('2026-06-15T12:00:00Z');
      const token = new AuthToken(validValue, boundary);

      // Act
      const result = token.isExpired(boundary);

      // Assert
      expect(result).toBe(true);
    });
  });

  // ============================================================
  // Safe string representation
  // ============================================================
  describe('toString', () => {
    it('should_return_redacted_marker_instead_of_actual_token_value', () => {
      // Arrange
      const token = new AuthToken(validValue, futureDate);

      // Act
      const result = token.toString();

      // Assert
      expect(result).toBe('[AuthToken]');
      expect(result).not.toContain(validValue);
    });
  });
});