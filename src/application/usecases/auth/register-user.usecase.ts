import { User } from '../../../domain/models/user';
import { Email } from '../../../domain/models/email';
import { AuthToken } from '../../../domain/models/auth-token';
import { IUserRepository } from '../../ports/out/user-repository.port';
import { IPasswordHasher } from '../../ports/out/password-hasher.port';
import { ITokenService } from '../../ports/out/token-service.port';
import { IClock } from '../../ports/out/clock.port';
import { IIdGenerator } from '../../ports/out/id-generator.port';
import { RegisterUserCommand } from './register-user.command';

/**
 * RegisterUserUseCase — application service that orchestrates
 * user registration.
 *
 * Responsibilities (SRP): coordinate the domain and the outbound
 * ports to produce a registered user and an auth token. This class
 * does not know how emails are validated, how passwords are hashed,
 * how tokens are issued, how ids are generated, or how time is
 * measured. Every one of those concerns lives behind a port.
 *
 * DIP in action: this class depends on five interfaces, none of
 * which have any concrete implementation in the application or
 * domain layers. Concrete adapters (BcryptPasswordHasher,
 * PostgresUserRepository, JwtTokenService, SystemClock,
 * UuidGenerator) live in the infrastructure layer.
 *
 * Business rules enforced:
 *   - The email must not already be registered
 *   - Password is hashed before construction of the User entity
 *     (the entity never sees plaintext)
 *   - createdAt is taken from the injected clock, not the system clock
 *   - id is taken from the injected id generator, not a hardcoded lib
 */
export class RegisterUserUseCase {
  constructor(
    private readonly users: IUserRepository,
    private readonly hasher: IPasswordHasher,
    private readonly tokens: ITokenService,
    private readonly clock: IClock,
    private readonly ids: IIdGenerator,
  ) {}

  async execute(command: RegisterUserCommand): Promise<AuthToken> {
    // 1. Wrap the raw email into the domain VO (which validates format).
    const email = new Email(command.email);

    // 2. Enforce uniqueness. This is business policy that lives here,
    //    not in the entity, because it requires a repository query.
    const existing = await this.users.findByEmail(email);
    if (existing !== null) {
      throw new Error('An account with this email already exists');
    }

    // 3. Hash the password. Plaintext never touches the entity.
    const passwordHash = await this.hasher.hash(command.password);

    // 4. Build the domain entity. All invariants are checked in the
    //    constructor of User and its VOs.
    const user = new User({
      id: this.ids.generate(),
      email,
      passwordHash,
      displayName: command.displayName,
      createdAt: this.clock.now(),
    });

    // 5. Persist. The repository knows how; we do not.
    await this.users.save(user);

    // 6. Issue a token for the freshly created user.
    const token = await this.tokens.issue(user.id);

    return token;
  }
}