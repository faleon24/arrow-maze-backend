import { Email } from '../../../domain/models/email';
import { AuthToken } from '../../../domain/models/auth-token';
import { IUserRepository } from '../../ports/out/user-repository.port';
import { IPasswordHasher } from '../../ports/out/password-hasher.port';
import { ITokenService } from '../../ports/out/token-service.port';
import { LoginCommand } from './login.command';

/**
 * LoginUseCase — application service that authenticates a user
 * and issues an auth token on success.
 *
 * Responsibilities (SRP): coordinate email lookup, password
 * verification, and token issuance. No knowledge of HTTP, JSON,
 * SQL, or any specific hashing algorithm.
 *
 * Security note: on failure, this use case throws a single generic
 * error ("Invalid credentials") regardless of whether the email is
 * unknown or the password is wrong. This prevents user enumeration
 * attacks, where a caller distinguishes registered from unregistered
 * emails based on the error message.
 *
 * DIP in action: depends on three interfaces, zero concrete
 * implementations.
 */
export class LoginUseCase {
  constructor(
    private readonly users: IUserRepository,
    private readonly hasher: IPasswordHasher,
    private readonly tokens: ITokenService,
  ) {}

  async execute(command: LoginCommand): Promise<AuthToken> {
    // 1. Wrap the raw email into the domain VO. If the format is
    //    invalid, the Email constructor throws. We rethrow a
    //    generic error to keep the security surface uniform.
    let email: Email;
    try {
      email = new Email(command.email);
    } catch {
      throw new Error('Invalid credentials');
    }

    // 2. Look up the user. A miss is not distinguishable from a
    //    wrong password from the caller's perspective.
    const user = await this.users.findByEmail(email);
    if (user === null) {
      throw new Error('Invalid credentials');
    }

    // 3. Verify the password against the stored hash.
    const matches = await this.hasher.verify(
      command.password,
      user.passwordHash,
    );
    if (!matches) {
      throw new Error('Invalid credentials');
    }

    // 4. On success, issue and return the auth token.
    return this.tokens.issue(user.id);
  }
}