import { JwtTokenService } from '../../../src/infrastructure/security/jwt-token-service';
import { AuthToken } from '../../../src/application/models/auth-token';

describe('JwtTokenService', () => {
  const TEST_SECRET = 'a_test_secret_that_is_long_enough_to_be_reasonable';

  const buildService = (expiresInSeconds: number = 3600) =>
    new JwtTokenService(TEST_SECRET, expiresInSeconds);

  // ============================================================
  // Construction
  // ============================================================
  describe('construction', () => {
    it('should_create_service_when_parameters_are_valid', () => {
      // Arrange + Act
      const service = new JwtTokenService(TEST_SECRET, 3600);

      // Assert
      expect(service).toBeInstanceOf(JwtTokenService);
    });

    it('should_throw_error_when_secret_is_empty', () => {
      // Act + Assert
      expect(() => new JwtTokenService('')).toThrow('JWT secret cannot be empty');
    });

    it('should_throw_error_when_expires_in_seconds_is_zero', () => {
      // Act + Assert
      expect(() => new JwtTokenService(TEST_SECRET, 0)).toThrow(
        'JWT expiresInSeconds must be a positive integer',
      );
    });

    it('should_throw_error_when_expires_in_seconds_is_negative', () => {
      // Act + Assert
      expect(() => new JwtTokenService(TEST_SECRET, -1)).toThrow(
        'JWT expiresInSeconds must be a positive integer',
      );
    });
  });

  // ============================================================
  // Issue
  // ============================================================
  describe('issue', () => {
    it('should_return_an_auth_token_when_user_id_is_valid', async () => {
      // Arrange
      const service = buildService();

      // Act
      const token = await service.issue('user-123');

      // Assert
      expect(token).toBeInstanceOf(AuthToken);
      expect(token.value).toMatch(/^ey/); // JWTs always start with "ey" (base64 of {"alg"..)
    });

    it('should_set_expires_at_in_the_future', async () => {
      // Arrange
      const service = buildService(3600);
      const before = Date.now();

      // Act
      const token = await service.issue('user-123');

      // Assert
      // ExpiresAt must be at least "before + expiresIn" and at most "now + expiresIn + slack".
      const expected = before + 3600 * 1000;
      expect(token.expiresAt.getTime()).toBeGreaterThanOrEqual(expected - 10);
      expect(token.expiresAt.getTime()).toBeLessThanOrEqual(expected + 1000);
    });

    it('should_throw_error_when_user_id_is_empty', async () => {
      // Arrange
      const service = buildService();

      // Act + Assert
      await expect(service.issue('')).rejects.toThrow('userId cannot be empty');
    });
  });

  // ============================================================
  // Verify
  // ============================================================
  describe('verify', () => {
    it('should_return_the_user_id_when_token_is_valid', async () => {
      // Arrange
      const service = buildService();
      const token = await service.issue('user-abc');

      // Act
      const userId = await service.verify(token.value);

      // Assert
      expect(userId).toBe('user-abc');
    });

    it('should_throw_invalid_token_when_signature_is_wrong', async () => {
      // Arrange
      const issuer = buildService();
      const attacker = new JwtTokenService('a_different_secret_a_different_secret');
      const token = await issuer.issue('user-abc');

      // Act + Assert
      await expect(attacker.verify(token.value)).rejects.toThrow('Invalid token');
    });

    it('should_throw_invalid_token_when_token_is_empty', async () => {
      // Arrange
      const service = buildService();

      // Act + Assert
      await expect(service.verify('')).rejects.toThrow('Invalid token');
    });

    it('should_throw_invalid_token_when_token_is_garbage', async () => {
      // Arrange
      const service = buildService();

      // Act + Assert
      await expect(service.verify('not.a.jwt')).rejects.toThrow('Invalid token');
    });

    it('should_throw_invalid_token_when_token_is_expired', async () => {
      // Arrange
      // Issue a token that expires in 1 second.
      const service = buildService(1);
      const token = await service.issue('user-abc');

      // Wait ~1.2s to guarantee expiration.
      await new Promise((resolve) => setTimeout(resolve, 1200));

      // Act + Assert
      await expect(service.verify(token.value)).rejects.toThrow('Invalid token');
    });
  });

  // ============================================================
  // Round trip
  // ============================================================
  describe('round trip', () => {
    it('should_recover_the_same_user_id_through_issue_then_verify', async () => {
      // Arrange
      const service = buildService();
      const userId = 'round-trip-user-xyz';

      // Act
      const token = await service.issue(userId);
      const recovered = await service.verify(token.value);

      // Assert
      expect(recovered).toBe(userId);
    });
  });
});