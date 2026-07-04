import { User, UserProps } from '../../../src/domain/models/user';
import { Email } from '../../../src/domain/models/email';
import { PasswordHash } from '../../../src/domain/models/password-hash';

describe('User', () => {
  const buildValidProps = (): UserProps => ({
    id: 'user-123',
    email: new Email('ana@example.com'),
    passwordHash: new PasswordHash(
      '$2b$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNO',
    ),
    displayName: 'Ana',
    createdAt: new Date('2026-01-15T10:00:00Z'),
  });

  // ============================================================
  // Creation
  // ============================================================
  describe('creation', () => {
    it('should_create_user_when_all_properties_are_valid', () => {
      // Arrange
      const props = buildValidProps();

      // Act
      const user = new User(props);

      // Assert
      expect(user.id).toBe('user-123');
      expect(user.email.value).toBe('ana@example.com');
      expect(user.passwordHash).toBeInstanceOf(PasswordHash);
      expect(user.displayName).toBe('Ana');
      expect(user.createdAt).toEqual(new Date('2026-01-15T10:00:00Z'));
    });

    it('should_trim_display_name_when_creating_user', () => {
      // Arrange
      const props = { ...buildValidProps(), displayName: '  Ana  ' };

      // Act
      const user = new User(props);

      // Assert
      expect(user.displayName).toBe('Ana');
    });

    it('should_throw_error_when_email_is_not_an_email_value_object', () => {
      // Arrange
      const props = {
        ...buildValidProps(),
        email: 'ana@example.com' as unknown as Email,
      };

      // Act + Assert
      expect(() => new User(props)).toThrow('Email must be an Email value object');
    });

    it('should_throw_error_when_password_hash_is_not_a_password_hash_value_object', () => {
      // Arrange
      const props = {
        ...buildValidProps(),
        passwordHash: 'raw_string_hash' as unknown as PasswordHash,
      };

      // Act + Assert
      expect(() => new User(props)).toThrow(
        'Password hash must be a PasswordHash value object',
      );
    });

    it('should_throw_error_when_display_name_is_empty_string', () => {
      // Arrange
      const props = { ...buildValidProps(), displayName: '' };

      // Act + Assert
      expect(() => new User(props)).toThrow('Display name cannot be empty');
    });

    it('should_throw_error_when_display_name_is_only_whitespace', () => {
      // Arrange
      const props = { ...buildValidProps(), displayName: '   ' };

      // Act + Assert
      expect(() => new User(props)).toThrow('Display name cannot be empty');
    });
  });

  // ============================================================
  // Value object delegation
  // ============================================================
  describe('value object delegation', () => {
    it('should_expose_email_as_email_value_object', () => {
      // Arrange
      const props = buildValidProps();

      // Act
      const user = new User(props);

      // Assert
      expect(user.email).toBeInstanceOf(Email);
    });

    it('should_expose_password_hash_as_password_hash_value_object', () => {
      // Arrange
      const props = buildValidProps();

      // Act
      const user = new User(props);

      // Assert
      expect(user.passwordHash).toBeInstanceOf(PasswordHash);
    });
  });

  // ============================================================
  // Rename behavior
  // ============================================================
  describe('rename', () => {
    it('should_change_display_name_when_new_name_is_valid', () => {
      // Arrange
      const user = new User(buildValidProps());

      // Act
      user.rename('Ana Maria');

      // Assert
      expect(user.displayName).toBe('Ana Maria');
    });

    it('should_trim_whitespace_when_renaming', () => {
      // Arrange
      const user = new User(buildValidProps());

      // Act
      user.rename('  Ana Maria  ');

      // Assert
      expect(user.displayName).toBe('Ana Maria');
    });

    it('should_throw_error_when_renaming_with_empty_string', () => {
      // Arrange
      const user = new User(buildValidProps());

      // Act + Assert
      expect(() => user.rename('')).toThrow('Display name cannot be empty');
    });

    it('should_throw_error_when_renaming_with_only_whitespace', () => {
      // Arrange
      const user = new User(buildValidProps());

      // Act + Assert
      expect(() => user.rename('   ')).toThrow('Display name cannot be empty');
    });

    it('should_keep_original_name_when_rename_fails', () => {
      // Arrange
      const user = new User(buildValidProps());
      const originalName = user.displayName;

      // Act
      try {
        user.rename('');
      } catch {
        // expected to throw
      }

      // Assert
      expect(user.displayName).toBe(originalName);
    });
  });

  // ============================================================
  // Encapsulation
  // ============================================================
  describe('encapsulation', () => {
    it('should_throw_type_error_when_attempting_to_mutate_property', () => {
      // Arrange
      const user = new User(buildValidProps());

      // Act + Assert
      expect(() => {
        // @ts-expect-error -- verifying encapsulation: no setter exists
        user.email = new Email('hacker@evil.com');
      }).toThrow(TypeError);
    });

    it('should_keep_original_value_when_mutation_is_attempted', () => {
      // Arrange
      const user = new User(buildValidProps());
      const originalEmailValue = user.email.value;

      // Act
      try {
        // @ts-expect-error -- verifying encapsulation: no setter exists
        user.email = new Email('hacker@evil.com');
      } catch {
        // expected TypeError
      }

      // Assert
      expect(user.email.value).toBe(originalEmailValue);
    });
  });
});