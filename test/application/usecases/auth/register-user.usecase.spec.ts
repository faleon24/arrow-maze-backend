import { RegisterUserUseCase } from '../../../../src/application/usecases/auth/register-user.usecase';
import { RegisterUserCommand } from '../../../../src/application/usecases/auth/register-user.command';
import { User } from '../../../../src/domain/models/user';
import { Email } from '../../../../src/domain/models/email';
import { PasswordHash } from '../../../../src/domain/models/password-hash';
import { AuthToken } from '../../../../src/domain/models/auth-token';
import { IUserRepository } from '../../../../src/application/ports/out/user-repository.port';
import { IPasswordHasher } from '../../../../src/application/ports/out/password-hasher.port';
import { ITokenService } from '../../../../src/application/ports/out/token-service.port';
import { IClock } from '../../../../src/application/ports/out/clock.port';
import { IIdGenerator } from '../../../../src/application/ports/out/id-generator.port';
import { EmailAlreadyRegisteredError } from '../../../../src/domain/errors';

// ============================================================
// Fakes
// ============================================================

class InMemoryUserRepository implements IUserRepository {
  private readonly store: Map<string, User> = new Map();

  async findById(id: string): Promise<User | null> {
    return this.store.get(id) ?? null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    for (const user of this.store.values()) {
      if (user.email.equals(email)) return user;
    }
    return null;
  }

  async save(user: User): Promise<void> {
    this.store.set(user.id, user);
  }

  size(): number {
    return this.store.size;
  }
}

class FakePasswordHasher implements IPasswordHasher {
  async hash(plaintext: string): Promise<PasswordHash> {
    const encoded = Buffer.from(plaintext).toString('base64');
    return new PasswordHash(`fake_hash_v1:${encoded}:padded_to_meet_length_requirement`);
  }

  async verify(plaintext: string, hash: PasswordHash): Promise<boolean> {
    const encoded = Buffer.from(plaintext).toString('base64');
    return hash.value === `fake_hash_v1:${encoded}:padded_to_meet_length_requirement`;
  }
}

class FakeTokenService implements ITokenService {
  issuedFor: string | null = null;

  async issue(userId: string): Promise<AuthToken> {
    this.issuedFor = userId;
    return new AuthToken(
      `token-for-${userId}`,
      new Date('2099-01-01T00:00:00Z'),
    );
  }

  async verify(_rawToken: string): Promise<string> {
    throw new Error('Not needed in these tests');
  }
}

class FixedClock implements IClock {
  constructor(private readonly fixed: Date) {}
  now(): Date {
    return this.fixed;
  }
}

class SequentialIdGenerator implements IIdGenerator {
  private counter = 0;
  generate(): string {
    this.counter += 1;
    return `id-${this.counter}`;
  }
}

// ============================================================
// Test suite
// ============================================================

describe('RegisterUserUseCase', () => {
  const buildDependencies = () => {
    const users = new InMemoryUserRepository();
    const hasher = new FakePasswordHasher();
    const tokens = new FakeTokenService();
    const clock = new FixedClock(new Date('2026-01-15T10:00:00Z'));
    const ids = new SequentialIdGenerator();
    const usecase = new RegisterUserUseCase(users, hasher, tokens, clock, ids);
    return { users, hasher, tokens, clock, ids, usecase };
  };

  const validCommand = (): RegisterUserCommand => ({
    email: 'ana@example.com',
    password: 'plaintext_password_12345',
    displayName: 'Ana',
  });

  describe('execute (happy path)', () => {
    it('should_persist_a_new_user_when_email_is_available', async () => {
      const { users, usecase } = buildDependencies();

      await usecase.execute(validCommand());

      expect(users.size()).toBe(1);
    });

    it('should_return_an_auth_token_when_registration_succeeds', async () => {
      const { usecase } = buildDependencies();

      const token = await usecase.execute(validCommand());

      expect(token).toBeInstanceOf(AuthToken);
      expect(token.value).toMatch(/^token-for-/);
    });

    it('should_issue_the_token_for_the_newly_created_user_id', async () => {
      const { tokens, usecase } = buildDependencies();

      await usecase.execute(validCommand());

      expect(tokens.issuedFor).toBe('id-1');
    });

    it('should_hash_the_password_before_persisting_the_user', async () => {
      const { users, usecase } = buildDependencies();
      const command = validCommand();

      await usecase.execute(command);

      const saved = await users.findByEmail(new Email(command.email));
      expect(saved).not.toBeNull();
      expect(saved!.passwordHash.value).not.toContain(command.password);
      expect(saved!.passwordHash.value).toContain('fake_hash_v1:');
    });

    it('should_use_the_injected_clock_as_the_created_at', async () => {
      const { users, usecase } = buildDependencies();

      await usecase.execute(validCommand());

      const saved = await users.findByEmail(new Email('ana@example.com'));
      expect(saved!.createdAt).toEqual(new Date('2026-01-15T10:00:00Z'));
    });

    it('should_use_the_injected_id_generator_for_the_user_id', async () => {
      const { users, usecase } = buildDependencies();

      await usecase.execute(validCommand());

      const saved = await users.findByEmail(new Email('ana@example.com'));
      expect(saved!.id).toBe('id-1');
    });
  });

  describe('execute (email uniqueness)', () => {
    it('should_throw_error_when_email_is_already_registered', async () => {
      const { usecase } = buildDependencies();
      await usecase.execute(validCommand());

      await expect(usecase.execute(validCommand())).rejects.toBeInstanceOf(
        EmailAlreadyRegisteredError,
      );
    });

    it('should_not_persist_a_second_user_when_email_is_taken', async () => {
      const { users, usecase } = buildDependencies();
      await usecase.execute(validCommand());

      try {
        await usecase.execute(validCommand());
      } catch {
        // expected
      }

      expect(users.size()).toBe(1);
    });

    it('should_treat_email_uniqueness_case_insensitively', async () => {
      const { usecase } = buildDependencies();
      await usecase.execute({
        ...validCommand(),
        email: 'ana@example.com',
      });

      await expect(
        usecase.execute({
          ...validCommand(),
          email: 'ANA@EXAMPLE.COM',
        }),
      ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
    });
  });

  describe('execute (input validation)', () => {
    it('should_throw_error_when_email_format_is_invalid', async () => {
      const { usecase } = buildDependencies();
      const command = { ...validCommand(), email: 'not-an-email' };

      await expect(usecase.execute(command)).rejects.toThrow('Invalid email format');
    });

    it('should_throw_error_when_display_name_is_empty', async () => {
      const { usecase } = buildDependencies();
      const command = { ...validCommand(), displayName: '   ' };

      await expect(usecase.execute(command)).rejects.toThrow(
        'Display name cannot be empty',
      );
    });
  });
});