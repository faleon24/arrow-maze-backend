import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IUserRepository } from '../../application/ports/out/user-repository.port';
import { User } from '../../domain/models/user';
import { Email } from '../../domain/models/email';
import { EmailAlreadyRegisteredError } from '../../domain/errors';
import { PrismaService } from './prisma.service';
import { UserMapper } from './user.mapper';

/**
 * PostgresUserRepository is the Prisma-backed adapter for IUserRepository.
 *
 * It sits in the infrastructure layer and translates the technology-agnostic
 * repository contract into concrete Prisma queries. All translation between
 * the domain aggregate and the persistence row is delegated to UserMapper,
 * keeping this class focused on queries only (SRP).
 *
 * Patterns applied here:
 *   - Adapter: exposes IUserRepository, adapts Prisma underneath.
 *   - Repository: hides persistence details from the application layer.
 *   - DIP: the use cases depend on IUserRepository, never on this class.
 *
 * Concurrency note (save):
 *   RegisterUserUseCase checks email uniqueness with `findByEmail` before
 *   calling `save`, which gives a friendly 409 in the common case. However,
 *   two simultaneous requests with the same email can both pass that check
 *   and race to insert — the second one violates the DB's UNIQUE constraint
 *   (Prisma error P2002). This adapter is the correct layer to translate
 *   that raw persistence error back into the domain language, so the filter
 *   maps it to 409 instead of 500. This is the "translate at the boundary"
 *   discipline of hexagonal architecture.
 */
@Injectable()
export class PostgresUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row === null ? null : UserMapper.toDomain(row);
  }

  async findByEmail(email: Email): Promise<User | null> {
    const row = await this.prisma.user.findUnique({
      where: { email: email.value },
    });
    return row === null ? null : UserMapper.toDomain(row);
  }

  async save(user: User): Promise<void> {
    const row = UserMapper.toPersistence(user);
    try {
      await this.prisma.user.upsert({
        where: { id: row.id },
        create: row,
        update: {
          email: row.email,
          passwordHash: row.passwordHash,
          displayName: row.displayName,
          // createdAt intentionally omitted on update — it's immutable.
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new EmailAlreadyRegisteredError(user.email.value);
      }
      throw e;
    }
  }
}