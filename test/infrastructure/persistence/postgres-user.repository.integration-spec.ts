import { PrismaClient } from '@prisma/client';
import { PostgresUserRepository } from '../../../src/infrastructure/persistence/postgres-user.repository';
import { PrismaService } from '../../../src/infrastructure/persistence/prisma.service';
import { User } from '../../../src/domain/models/user';
import { Email } from '../../../src/domain/models/email';
import { PasswordHash } from '../../../src/domain/models/password-hash';
import { DatabaseCleaner } from '../helpers/database-cleaner';

/**
 * Integration tests for PostgresUserRepository.
 *
 * These tests exercise the adapter against a REAL PostgreSQL instance
 * (arrowmaze_test). No mocks. The point is to prove that the queries,
 * the mapper, and the schema all agree.
 *
 * Rationale: mocking Prisma would only prove that the mock matches our
 * expectations. Running against a real database proves that the query
 * we write is the query the database understands, and that the row it
 * gives back can actually be turned into a valid User aggregate.
 */
describe('PostgresUserRepository (integration)', () => {
  let prisma: PrismaService;
  let repository: PostgresUserRepository;
  let cleaner: DatabaseCleaner;

  const buildValidUser = (overrides: Partial<{
    id: string;
    email: string;
    displayName: string;
  }> = {}): User =>
    new User({
      id: overrides.id ?? '550e8400-e29b-41d4-a716-446655440000',
      email: new Email(overrides.email ?? 'alice@example.com'),
      passwordHash: new PasswordHash(
        '$2b$04$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQR',
      ),
      displayName: overrides.displayName ?? 'Alice',
      createdAt: new Date('2025-01-15T10:00:00.000Z'),
    });

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    repository = new PostgresUserRepository(prisma);
    cleaner = new DatabaseCleaner(prisma as unknown as PrismaClient);
  });

  afterEach(async () => {
    await cleaner.cleanAll();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // -------- findById --------

  describe('findById', () => {
    it('should_return_null_when_user_does_not_exist', async () => {
      // Arrange
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // Act
      const result = await repository.findById(nonExistentId);

      // Assert
      expect(result).toBeNull();
    });

    it('should_return_User_when_user_exists', async () => {
      // Arrange
      const user = buildValidUser();
      await repository.save(user);

      // Act
      const result = await repository.findById(user.id);

      // Assert
      expect(result).not.toBeNull();
      expect(result).toBeInstanceOf(User);
      expect(result!.id).toBe(user.id);
    });
  });

  // -------- findByEmail --------

  describe('findByEmail', () => {
    it('should_return_null_when_email_is_not_registered', async () => {
      // Arrange
      const email = new Email('nobody@example.com');

      // Act
      const result = await repository.findByEmail(email);

      // Assert
      expect(result).toBeNull();
    });

    it('should_return_User_when_email_is_registered', async () => {
      // Arrange
      const user = buildValidUser();
      await repository.save(user);

      // Act
      const result = await repository.findByEmail(user.email);

      // Assert
      expect(result).not.toBeNull();
      expect(result!.email.value).toBe(user.email.value);
    });
  });

  // -------- save (insert) --------

  describe('save (insert path)', () => {
    it('should_persist_a_new_user_when_id_does_not_exist', async () => {
      // Arrange
      const user = buildValidUser();

      // Act
      await repository.save(user);

      // Assert
      const fetched = await repository.findById(user.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.email.value).toBe(user.email.value);
      expect(fetched!.displayName).toBe(user.displayName);
    });

    it('should_persist_multiple_users_when_emails_are_different', async () => {
      // Arrange
      const alice = buildValidUser({
        id: '11111111-1111-1111-1111-111111111111',
        email: 'alice@example.com',
        displayName: 'Alice',
      });
      const bob = buildValidUser({
        id: '22222222-2222-2222-2222-222222222222',
        email: 'bob@example.com',
        displayName: 'Bob',
      });

      // Act
      await repository.save(alice);
      await repository.save(bob);

      // Assert
      const fetchedAlice = await repository.findByEmail(alice.email);
      const fetchedBob = await repository.findByEmail(bob.email);
      expect(fetchedAlice!.id).toBe(alice.id);
      expect(fetchedBob!.id).toBe(bob.id);
    });
  });

  // -------- save (update) --------

  describe('save (update path)', () => {
    it('should_update_displayName_when_saving_existing_user', async () => {
      // Arrange
      const original = buildValidUser({ displayName: 'Alice' });
      await repository.save(original);

      const renamed = buildValidUser({ displayName: 'Alice Renamed' });

      // Act
      await repository.save(renamed);

      // Assert
      const fetched = await repository.findById(original.id);
      expect(fetched!.displayName).toBe('Alice Renamed');
    });

    it('should_preserve_original_createdAt_when_updating_existing_user', async () => {
      // Arrange
      const original = buildValidUser();
      await repository.save(original);

      // Build a "new" version of the same user with a DIFFERENT createdAt.
      // The repository must ignore the incoming createdAt on update.
      const tampered = new User({
        id: original.id,
        email: original.email,
        passwordHash: original.passwordHash,
        displayName: 'Alice Renamed',
        createdAt: new Date('2099-12-31T23:59:59.000Z'), // clearly wrong
      });

      // Act
      await repository.save(tampered);

      // Assert
      const fetched = await repository.findById(original.id);
      expect(fetched!.createdAt).toEqual(original.createdAt);
    });
  });

  // -------- Round-trip integrity --------

  describe('round-trip integrity', () => {
    it('should_preserve_all_fields_through_save_and_findById', async () => {
      // Arrange
      const original = buildValidUser();

      // Act
      await repository.save(original);
      const fetched = await repository.findById(original.id);

      // Assert
      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(original.id);
      expect(fetched!.email.value).toBe(original.email.value);
      expect(fetched!.passwordHash.value).toBe(original.passwordHash.value);
      expect(fetched!.displayName).toBe(original.displayName);
      expect(fetched!.createdAt).toEqual(original.createdAt);
    });
  });
});