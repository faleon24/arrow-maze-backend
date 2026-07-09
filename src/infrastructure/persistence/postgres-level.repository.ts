import { Injectable } from '@nestjs/common';
import { ILevelRepository } from '../../application/ports/out/level-repository.port';
import { Level } from '../../domain/models/level';
import { PrismaService } from './prisma.service';
import { LevelMapper, LevelPersistenceRow } from './level.mapper';

/**
 * PostgresLevelRepository — Prisma-backed adapter for ILevelRepository.
 *
 * Translates the technology-agnostic repository contract into concrete
 * Prisma queries and delegates all domain<->row translation to
 * LevelMapper, staying focused on queries only (SRP).
 *
 * Patterns applied:
 *   - Adapter: exposes ILevelRepository, adapts Prisma underneath.
 *   - Repository: hides persistence details from the application layer.
 *   - DIP: use cases depend on ILevelRepository, never on this class.
 */
@Injectable()
export class PostgresLevelRepository implements ILevelRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Level | null> {
    const row = await this.prisma.level.findUnique({ where: { id } });
    return row === null
      ? null
      : LevelMapper.toDomain(row as unknown as LevelPersistenceRow);
  }

  async findAll(): Promise<Level[]> {
    const rows = await this.prisma.level.findMany({
      orderBy: { index: 'asc' },
    });
    return rows.map((r) =>
      LevelMapper.toDomain(r as unknown as LevelPersistenceRow),
    );
  }

  async findAllPublished(): Promise<Level[]> {
    const rows = await this.prisma.level.findMany({
      where: { published: true },
      orderBy: { index: 'asc' },
    });
    return rows.map((r) =>
      LevelMapper.toDomain(r as unknown as LevelPersistenceRow),
    );
  }

  async save(level: Level): Promise<void> {
    const row = LevelMapper.toPersistence(level);
    await this.prisma.level.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        index: row.index,
        difficulty: row.difficulty,
        rows: row.rows,
        cols: row.cols,
        cells: row.cells as object,
        parTimeMs: row.parTimeMs,
        published: row.published,
        // createdAt omitted — DB default handles it on insert.
      },
      update: {
        index: row.index,
        difficulty: row.difficulty,
        rows: row.rows,
        cols: row.cols,
        cells: row.cells as object,
        parTimeMs: row.parTimeMs,
        published: row.published,
        // createdAt intentionally omitted — it's immutable.
      },
    });
  }
}