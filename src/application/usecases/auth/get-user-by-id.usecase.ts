import { User } from '../../../domain/models/user';
import { InvalidTokenError } from '../../../domain/errors';
import { IUserRepository } from '../../ports/out/user-repository.port';
import { GetUserByIdCommand } from './get-user-by-id.command';

/**
 * GetUserByIdUseCase — application service that resolves the
 * currently authenticated user from their id.
 *
 * Used by the GET /auth/me endpoint after the JwtAuthGuard has
 * verified the token and extracted the user id. If the id does
 * not correspond to an existing user (e.g. the account was
 * deleted after the token was issued), it throws InvalidTokenError
 * so the caller receives a 401 rather than leaking that the id
 * was well-formed but absent.
 *
 * DIP: depends only on the IUserRepository abstraction.
 */
export class GetUserByIdUseCase {
  constructor(private readonly users: IUserRepository) {}

  async execute(command: GetUserByIdCommand): Promise<User> {
    const user = await this.users.findById(command.userId);
    if (user === null) {
      throw new InvalidTokenError();
    }
    return user;
  }
}