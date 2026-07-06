import { UserMapper, UserPersistenceRow } from '../../../src/infrastructure/persistence/user.mapper';
import { User } from '../../../src/domain/models/user';
import { Email } from '../../../src/domain/models/email';
import { PasswordHash } from '../../../src/domain/models/password-hash';

describe('UserMapper', () => {
  // Factory to avoid shared mutable state between tests
  const buildValidRow = (): UserPersistenceRow => ({
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'alice@example.com',
    passwordHash: '$2b$04$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQR',
    displayName: 'Alice',
    createdAt: new Date('2025-01-15T10:00:00.000Z'),
  });

  const buildValidUser = (): User =>
    new User({
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: new Email('alice@example.com'),
      passwordHash: new PasswordHash(
        '$2b$04$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQR',
      ),
      displayName: 'Alice',
      createdAt: new Date('2025-01-15T10:00:00.000Z'),
    });

  // -------- toDomain --------

  describe('toDomain', () => {
    it('should_return_User_instance_when_row_is_valid', () => {
      // Arrange
      const row = buildValidRow();

      // Act
      const user = UserMapper.toDomain(row);

      // Assert
      expect(user).toBeInstanceOf(User);
    });

    it('should_preserve_id_when_mapping_from_row', () => {
      // Arrange
      const row = buildValidRow();

      // Act
      const user = UserMapper.toDomain(row);

      // Assert
      expect(user.id).toBe(row.id);
    });

    it('should_wrap_email_string_into_Email_value_object', () => {
      // Arrange
      const row = buildValidRow();

      // Act
      const user = UserMapper.toDomain(row);

      // Assert
      expect(user.email).toBeInstanceOf(Email);
      expect(user.email.value).toBe(row.email);
    });

    it('should_wrap_hash_string_into_PasswordHash_value_object', () => {
      // Arrange
      const row = buildValidRow();

      // Act
      const user = UserMapper.toDomain(row);

      // Assert
      expect(user.passwordHash).toBeInstanceOf(PasswordHash);
      expect(user.passwordHash.value).toBe(row.passwordHash);
    });

    it('should_preserve_displayName_when_mapping_from_row', () => {
      // Arrange
      const row = buildValidRow();

      // Act
      const user = UserMapper.toDomain(row);

      // Assert
      expect(user.displayName).toBe(row.displayName);
    });

    it('should_preserve_createdAt_when_mapping_from_row', () => {
      // Arrange
      const row = buildValidRow();

      // Act
      const user = UserMapper.toDomain(row);

      // Assert
      expect(user.createdAt).toEqual(row.createdAt);
    });

    it('should_throw_when_row_email_is_invalid', () => {
      // Arrange
      const row = { ...buildValidRow(), email: 'not-a-valid-email' };

      // Act + Assert
      expect(() => UserMapper.toDomain(row)).toThrow();
    });

    it('should_throw_when_row_displayName_is_empty', () => {
      // Arrange
      const row = { ...buildValidRow(), displayName: '' };

      // Act + Assert
      expect(() => UserMapper.toDomain(row)).toThrow();
    });
  });

  // -------- toPersistence --------

  describe('toPersistence', () => {
    it('should_return_plain_object_when_mapping_from_User', () => {
      // Arrange
      const user = buildValidUser();

      // Act
      const row = UserMapper.toPersistence(user);

      // Assert
      expect(row).toEqual({
        id: user.id,
        email: user.email.value,
        passwordHash: user.passwordHash.value,
        displayName: user.displayName,
        createdAt: user.createdAt,
      });
    });

    it('should_unwrap_Email_value_object_into_string', () => {
      // Arrange
      const user = buildValidUser();

      // Act
      const row = UserMapper.toPersistence(user);

      // Assert
      expect(typeof row.email).toBe('string');
      expect(row.email).toBe('alice@example.com');
    });

    it('should_unwrap_PasswordHash_value_object_into_string', () => {
      // Arrange
      const user = buildValidUser();

      // Act
      const row = UserMapper.toPersistence(user);

      // Assert
      expect(typeof row.passwordHash).toBe('string');
    });
  });

  // -------- Round-trip --------

  describe('round-trip', () => {
    it('should_return_original_row_when_mapping_toDomain_then_toPersistence', () => {
      // Arrange
      const original = buildValidRow();

      // Act
      const roundTripped = UserMapper.toPersistence(UserMapper.toDomain(original));

      // Assert
      expect(roundTripped).toEqual(original);
    });
  });
});