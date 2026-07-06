import { Injectable } from '@nestjs/common';
import { IUserRepository } from '../../application/ports/out/user-repository.port';
import { User } from '../../domain/models/user';
import { Email } from '../../domain/models/email';
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
  }
}