import { User } from '../../domain/models/user';
import { Email } from '../../domain/models/email';
import { PasswordHash } from '../../domain/models/password-hash';

export interface UserPersistenceRow {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  createdAt: Date;
}

export class UserMapper {
  static toDomain(row: UserPersistenceRow): User {
    return new User({
      id: row.id,
      email: new Email(row.email),
      passwordHash: new PasswordHash(row.passwordHash),
      displayName: row.displayName,
      createdAt: row.createdAt,
    });
  }

  static toPersistence(user: User): UserPersistenceRow {
    return {
      id: user.id,
      email: user.email.value,
      passwordHash: user.passwordHash.value,
      displayName: user.displayName,
      createdAt: user.createdAt,
    };
  }
}