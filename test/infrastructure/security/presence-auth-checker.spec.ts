import { PresenceAuthChecker } from '../../../src/infrastructure/security/presence-auth-checker';

describe('PresenceAuthChecker', () => {
  const checker = new PresenceAuthChecker();

  it('should_authenticate_a_non_empty_subject', () => {
    // Arrange + Act + Assert
    expect(checker.isAuthenticated('user-123')).toBe(true);
  });

  it('should_reject_an_empty_string_subject', () => {
    expect(checker.isAuthenticated('')).toBe(false);
  });

  it('should_reject_a_whitespace_only_subject', () => {
    expect(checker.isAuthenticated('   ')).toBe(false);
  });

  it('should_reject_an_undefined_subject', () => {
    expect(checker.isAuthenticated(undefined)).toBe(false);
  });

  it('should_reject_a_null_subject', () => {
    expect(checker.isAuthenticated(null)).toBe(false);
  });
});
