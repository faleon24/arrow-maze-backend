import { User, UserProps } from '../../../src/domain/models/user';

describe('User', () => {
  // Valid props reused across tests. We clone with spread when we need to mutate.
  const validProps: UserProps = {
    id: 'user-123',
    email: 'ana@example.com',
    passwordHash: 'hashed_password_value',
    displayName: 'Ana',
    createdAt: new Date('2026-01-15T10:00:00Z'),
  };

  // ============================================================
  // Creation
  // ============================================================
  describe('creation', () => {
    it('should_create_user_when_all_properties_are_valid', () => {
      // Arrange
      const props = { ...validProps };

      // Act
      const user = new User(props);

      // Assert
      expect(user.id).toBe('user-123');
      expect(user.email).toBe('ana@example.com');
      expect(user.passwordHash).toBe('hashed_password_value');
      expect(user.displayName).toBe('Ana');
      expect(user.createdAt).toEqual(new Date('2026-01-15T10:00:00Z'));
    });

    it('should_trim_display_name_when_creating_user', () => {
      // Arrange
      const props = { ...validProps, displayName: '  Ana  ' };

      // Act
      const user = new User(props);

      // Assert
      expect(user.displayName).toBe('Ana');
    });

    it('should_throw_error_when_email_format_is_invalid', () => {
      // Arrange
      const props = { ...validProps, email: 'not-an-email' };

      // Act + Assert
      expect(() => new User(props)).toThrow('Invalid email format');
    });

    it('should_throw_error_when_email_has_no_domain', () => {
      // Arrange
      const props = { ...validProps, email: 'ana@' };

      // Act + Assert
      expect(() => new User(props)).toThrow('Invalid email format');
    });

    it('should_throw_error_when_email_has_no_at_sign', () => {
      // Arrange
      const props = { ...validProps, email: 'anaexample.com' };

      // Act + Assert
      expect(() => new User(props)).toThrow('Invalid email format');
    });

    it('should_throw_error_when_display_name_is_empty_string', () => {
      // Arrange
      const props = { ...validProps, displayName: '' };

      // Act + Assert
      expect(() => new User(props)).toThrow('Display name cannot be empty');
    });

    it('should_throw_error_when_display_name_is_only_whitespace', () => {
      // Arrange
      const props = { ...validProps, displayName: '   ' };

      // Act + Assert
      expect(() => new User(props)).toThrow('Display name cannot be empty');
    });

    it('should_throw_error_when_password_hash_is_empty', () => {
      // Arrange
      const props = { ...validProps, passwordHash: '' };

      // Act + Assert
      expect(() => new User(props)).toThrow('Password hash cannot be empty');
    });
  });

  // ============================================================
  // Rename behavior
  // ============================================================
  describe('rename', () => {
    it('should_change_display_name_when_new_name_is_valid', () => {
      // Arrange
      const user = new User(validProps);

      // Act
      user.rename('Ana Maria');

      // Assert
      expect(user.displayName).toBe('Ana Maria');
    });

    it('should_trim_whitespace_when_renaming', () => {
      // Arrange
      const user = new User(validProps);

      // Act
      user.rename('  Ana Maria  ');

      // Assert
      expect(user.displayName).toBe('Ana Maria');
    });

    it('should_throw_error_when_renaming_with_empty_string', () => {
      // Arrange
      const user = new User(validProps);

      // Act + Assert
      expect(() => user.rename('')).toThrow('Display name cannot be empty');
    });

    it('should_throw_error_when_renaming_with_only_whitespace', () => {
      // Arrange
      const user = new User(validProps);

      // Act + Assert
      expect(() => user.rename('   ')).toThrow('Display name cannot be empty');
    });

    it('should_keep_original_name_when_rename_fails', () => {
      // Arrange
      const user = new User(validProps);
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
  // ============================================================
  // Encapsulation
  // ============================================================
 // ============================================================
  // Encapsulation
  // ============================================================
  describe('encapsulation', () => {
    it('should_throw_type_error_when_attempting_to_mutate_property', () => {
      // Arrange
      const user = new User(validProps);

      // Act + Assert
      // Getters have no setter. Any attempt to reassign must throw at runtime.
      expect(() => {
        // @ts-expect-error -- verifying encapsulation: no setter exists
        user.email = 'hacker@evil.com';
      }).toThrow(TypeError);
    });

    it('should_keep_original_value_when_mutation_is_attempted', () => {
      // Arrange
      const user = new User(validProps);
      const originalEmail = user.email;

      // Act
      try {
        // @ts-expect-error -- verifying encapsulation: no setter exists
        user.email = 'hacker@evil.com';
      } catch {
        // expected TypeError
      }

      // Assert
      expect(user.email).toBe(originalEmail);
    });
  });
});