import { LoginUseCase } from '../../../../src/application/usecases/auth/login.usecase';
import { LoginCommand } from '../../../../src/application/usecases/auth/login.command';
import { User } from '../../../../src/domain/models/user';
import { Email } from '../../../../src/domain/models/email';
import { PasswordHash } from '../../../../src/domain/models/password-hash';
import { AuthToken } from '../../../../src/domain/models/auth-token';
import { IUserRepository } from '../../../../src/application/ports/out/user-repository.port';
import { IPasswordHasher } from '../../../../src/application/ports/out/password-hasher.port';
import { ITokenService } from '../../../../src/application/ports/out/token-service.port';

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

// ============================================================
// Test helpers
// ============================================================

const buildStoredUser = async (
  hasher: IPasswordHasher,
  overrides: { email?: string; password?: string } = {},
): Promise<User> => {
  const emailStr = overrides.email ?? 'ana@example.com';
  const password = overrides.password ?? 'plaintext_password_12345';
  const hash = await hasher.hash(password);
  return new User({
    id: 'user-1',
    email: new Email(emailStr),
    passwordHash: hash,
    displayName: 'Ana',
    createdAt: new Date('2026-01-15T10:00:00Z'),
  });
};

// ============================================================
// Test suite
// ============================================================

describe('LoginUseCase', () => {
  const buildDependencies = () => {
    const users = new InMemoryUserRepository();
    const hasher = new FakePasswordHasher();
    const tokens = new FakeTokenService();
    const usecase = new LoginUseCase(users, hasher, tokens);
    return { users, hasher, tokens, usecase };
  };

  const validCommand = (): LoginCommand => ({
    email: 'ana@example.com',
    password: 'plaintext_password_12345',
  });

  describe('execute (happy path)', () => {
    it('should_return_an_auth_token_when_credentials_are_valid', async () => {
      const { users, hasher, usecase } = buildDependencies();
      const user = await buildStoredUser(hasher);
      await users.save(user);

      const token = await usecase.execute(validCommand());

      expect(token).toBeInstanceOf(AuthToken);
      expect(token.value).toBe('token-for-user-1');
    });

    it('should_issue_the_token_for_the_matching_user_id', async () => {
      const { users, hasher, tokens, usecase } = buildDependencies();
      const user = await buildStoredUser(hasher);
      await users.save(user);

      await usecase.execute(validCommand());

      expect(tokens.issuedFor).toBe('user-1');
    });

    it('should_match_email_case_insensitively', async () => {
      const { users, hasher, usecase } = buildDependencies();
      const user = await buildStoredUser(hasher, { email: 'ana@example.com' });
      await users.save(user);

      const token = await usecase.execute({
        email: 'ANA@Example.COM',
        password: 'plaintext_password_12345',
      });

      expect(token).toBeInstanceOf(AuthToken);
    });
  });

  describe('execute (failure paths)', () => {
    it('should_throw_invalid_credentials_when_email_is_unknown', async () => {
      const { usecase } = buildDependencies();

      await expect(usecase.execute(validCommand())).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('should_throw_invalid_credentials_when_password_is_wrong', async () => {
      const { users, hasher, usecase } = buildDependencies();
      const user = await buildStoredUser(hasher);
      await users.save(user);

      await expect(
        usecase.execute({
          email: 'ana@example.com',
          password: 'a_different_wrong_password_9999',
        }),
      ).rejects.toThrow('Invalid credentials');
    });

    it('should_throw_invalid_credentials_when_email_format_is_invalid', async () => {
      const { usecase } = buildDependencies();

      await expect(
        usecase.execute({
          email: 'not-a-real-email',
          password: 'anything',
        }),
      ).rejects.toThrow('Invalid credentials');
    });

    it('should_not_issue_a_token_when_credentials_are_invalid', async () => {
      const { tokens, usecase } = buildDependencies();

      try {
        await usecase.execute(validCommand());
      } catch {
        // expected
      }

      expect(tokens.issuedFor).toBeNull();
    });
  });

  describe('execute (security)', () => {
    it('should_use_the_exact_same_error_message_for_unknown_email_and_wrong_password', async () => {
      const { users, hasher, usecase } = buildDependencies();
      const user = await buildStoredUser(hasher);
      await users.save(user);

      let errorForUnknownEmail = '';
      try {
        await usecase.execute({
          email: 'unknown@example.com',
          password: 'anything',
        });
      } catch (e) {
        errorForUnknownEmail = (e as Error).message;
      }

      let errorForWrongPassword = '';
      try {
        await usecase.execute({
          email: 'ana@example.com',
          password: 'wrong_password_but_long_enough',
        });
      } catch (e) {
        errorForWrongPassword = (e as Error).message;
      }

      expect(errorForUnknownEmail).toBe('Invalid credentials');
      expect(errorForWrongPassword).toBe('Invalid credentials');
      expect(errorForUnknownEmail).toBe(errorForWrongPassword);
    });
  });
});