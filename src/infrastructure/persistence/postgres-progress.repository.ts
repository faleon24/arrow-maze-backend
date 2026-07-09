import { Injectable } from '@nestjs/common';
import { IProgressRepository } from '../../application/ports/out/progress-repository.port';
import { IIdGenerator } from '../../application/ports/out/id-generator.port';
import { PlayerProgress } from '../../domain/models/player-progress';
import { PrismaService } from './prisma.service';
import { ProgressMapper, ProgressEntryRow } from './progress.mapper';

/**
 * PostgresProgressRepository — Prisma-backed adapter for
 * IProgressRepository.
 *
 * A PlayerProgress aggregate is stored as many progress_entries rows
 * (one per level). This adapter assembles the aggregate on read and
 * upserts each entry on write, keyed by the (userId, levelId) unique
 * constraint so saving is idempotent per level. All row<->domain
 * translation is delegated to ProgressMapper (SRP).
 *
 * Patterns applied:
 *   - Adapter / Repository: exposes IProgressRepository over Prisma.
 *   - DIP: use cases depend on the port, never on this class.
 */
@Injectable()
export class PostgresProgressRepository implements IProgressRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IIdGenerator,
  ) {}

  async findByUser(userId: string): Promise<PlayerProgress> {
    const rows = await this.prisma.progressEntry.findMany({
      where: { userId },
      orderBy: { levelId: 'asc' },
    });

    const entries = rows.map((r) =>
      ProgressMapper.toDomain(r as unknown as ProgressEntryRow),
    );

    // Always returns an aggregate — empty if the user has no rows yet.
    return new PlayerProgress(userId, entries);
  }

  async save(progress: PlayerProgress): Promise<void> {
    // Upsert each entry independently, keyed by (userId, levelId). We
    // look up the existing row's id to preserve it on update; new
    // entries get a fresh generated id. Ordering the writes is
    // unnecessary — entries are independent per level.
    for (const entry of progress.entries) {
      const existing = await this.prisma.progressEntry.findUnique({
        where: {
          userId_levelId: {
            userId: progress.userId,
            levelId: entry.levelId,
          },
        },
      });

      const id = existing?.id ?? this.ids.generate();
      const row = ProgressMapper.toPersistence(progress.userId, id, entry);

      await this.prisma.progressEntry.upsert({
        where: {
          userId_levelId: {
            userId: progress.userId,
            levelId: entry.levelId,
          },
        },
        create: {
          id: row.id,
          userId: row.userId,
          levelId: row.levelId,
          moves: row.moves,
          timeMs: row.timeMs,
          stars: row.stars,
          attempts: row.attempts,
          completedAt: row.completedAt,
        },
        update: {
          moves: row.moves,
          timeMs: row.timeMs,
          stars: row.stars,
          attempts: row.attempts,
          // completedAt intentionally omitted — first-completion is immutable.
          // userId/levelId are the key, never updated.
        },
      });
    }
  }
}