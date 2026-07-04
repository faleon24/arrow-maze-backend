import { Email } from '../../../src/domain/models/email';

describe('Email', () => {
  // ============================================================
  // Creation and validation
  // ============================================================
  describe('creation', () => {
    it('should_create_email_when_format_is_valid', () => {
      // Arrange
      const raw = 'ana@example.com';

      // Act
      const email = new Email(raw);

      // Assert
      expect(email.value).toBe('ana@example.com');
    });

    it('should_throw_error_when_format_has_no_at_sign', () => {
      // Arrange
      const raw = 'anaexample.com';

      // Act + Assert
      expect(() => new Email(raw)).toThrow('Invalid email format');
    });

    it('should_throw_error_when_format_has_no_domain', () => {
      // Arrange
      const raw = 'ana@';

      // Act + Assert
      expect(() => new Email(raw)).toThrow('Invalid email format');
    });

    it('should_throw_error_when_format_has_no_local_part', () => {
      // Arrange
      const raw = '@example.com';

      // Act + Assert
      expect(() => new Email(raw)).toThrow('Invalid email format');
    });

    it('should_throw_error_when_format_has_no_tld', () => {
      // Arrange
      const raw = 'ana@example';

      // Act + Assert
      expect(() => new Email(raw)).toThrow('Invalid email format');
    });

    it('should_throw_error_when_value_is_empty', () => {
      // Arrange
      const raw = '';

      // Act + Assert
      expect(() => new Email(raw)).toThrow('Email cannot be empty');
    });

    it('should_throw_error_when_value_is_only_whitespace', () => {
      // Arrange
      const raw = '   ';

      // Act + Assert
      expect(() => new Email(raw)).toThrow('Email cannot be empty');
    });
  });

  // ============================================================
  // Normalization
  // ============================================================
  describe('normalization', () => {
    it('should_lowercase_email_when_input_has_uppercase', () => {
      // Arrange
      const raw = 'Ana@Example.COM';

      // Act
      const email = new Email(raw);

      // Assert
      expect(email.value).toBe('ana@example.com');
    });

    it('should_trim_whitespace_when_input_has_leading_or_trailing_spaces', () => {
      // Arrange
      const raw = '  ana@example.com  ';

      // Act
      const email = new Email(raw);

      // Assert
      expect(email.value).toBe('ana@example.com');
    });

    it('should_apply_both_trim_and_lowercase_in_one_step', () => {
      // Arrange
      const raw = '  ANA@EXAMPLE.COM  ';

      // Act
      const email = new Email(raw);

      // Assert
      expect(email.value).toBe('ana@example.com');
    });
  });

  // ============================================================
  // Equality (value object semantics)
  // ============================================================
  describe('equals', () => {
    it('should_return_true_when_two_emails_have_same_normalized_value', () => {
      // Arrange
      const emailA = new Email('ana@example.com');
      const emailB = new Email('ANA@example.com');

      // Act
      const result = emailA.equals(emailB);

      // Assert
      expect(result).toBe(true);
    });

    it('should_return_false_when_two_emails_have_different_values', () => {
      // Arrange
      const emailA = new Email('ana@example.com');
      const emailB = new Email('luis@example.com');

      // Act
      const result = emailA.equals(emailB);

      // Assert
      expect(result).toBe(false);
    });

    it('should_return_false_when_compared_with_non_email_object', () => {
      // Arrange
      const email = new Email('ana@example.com');
      const notAnEmail = { value: 'ana@example.com' };

      // Act
      // @ts-expect-error -- deliberately passing wrong type
      const result = email.equals(notAnEmail);

      // Assert
      expect(result).toBe(false);
    });
  });

  // ============================================================
  // toString
  // ============================================================
  describe('toString', () => {
    it('should_return_the_normalized_value', () => {
      // Arrange
      const email = new Email('  ANA@Example.COM  ');

      // Act
      const result = email.toString();

      // Assert
      expect(result).toBe('ana@example.com');
    });
  });
});