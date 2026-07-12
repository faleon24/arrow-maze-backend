import { Level } from '../../domain/models/level';
import { BoardLayout } from '../../domain/models/board-layout';
import { ArrowPathInfo } from '../../domain/models/arrow-path-info';
import { CollectibleInfo } from '../../domain/models/collectible-info';
import { DifficultyProfileFactory } from '../../domain/models/difficulty-profile.factory';
/**
 * The shape of a v2 levels row as Prisma returns it. The three board
 * component columns (arrows / walls / collectibles) are typed loosely
 * as `unknown`: Prisma models them as JsonValue, but this mapper
 * validates them structurally instead of trusting the type — a schema
 * drift or a bad manual insert cannot slip past.
 */
export interface LevelPersistenceRow {
  id: string;
  index: number;
  difficulty: string;
  rows: number;
  cols: number;
  arrows: unknown;
  walls: unknown;
  collectibles: unknown;
  parTimeMs: number;
  timeLimitMs: number | null;
  published: boolean;
  createdAt: Date;
}
interface RawArrow {
  id: string;
  color: string;
  cells: string[];
  direction: string;
}
interface RawCollectible {
  position: string;
  kind: string;
}
/**
 * LevelMapper — Data Mapper between the Level aggregate and its v2
 * persistence row.
 *
 * Two design decisions pay off here:
 *
 *  - toDomain uses DifficultyProfileFactory (the Factory Method) to
 *    turn the stored difficulty label into the right DifficultyProfile
 *    strategy. Persistence holds a string; the domain always holds
 *    behavior. The mapper is the single place that bridges them.
 *
 *  - The board is stored across three JSON columns. toDomain rebuilds
 *    each VO (ArrowPathInfo, CollectibleInfo) — which re-validates
 *    it — and hands them to BoardLayout (which re-checks the board
 *    invariants). Even data that somehow got corrupt in Postgres
 *    cannot produce an invalid in-memory board; it fails fast instead.
 *
 * The return type of toPersistence is `Omit<..., 'createdAt'>` so the
 * DB default drives the insert and no caller can accidentally race it.
 * Kills the previous v1 smell of `createdAt: undefined as unknown as
 * Date`.
 *
 * Keeping this translation here (not in the repository) keeps the
 * repository focused on queries only (SRP), exactly like UserMapper.
 */
export class LevelMapper {
  static toDomain(row: LevelPersistenceRow): Level {
    const rawArrows = LevelMapper.parseArrows(row.arrows);
    const arrows = rawArrows.map(
      (a) => new ArrowPathInfo(a.id, a.color, a.cells, a.direction),
    );
    const walls = LevelMapper.parseWalls(row.walls);
    const rawCollectibles = LevelMapper.parseCollectibles(row.collectibles);
    const collectibles = rawCollectibles.map(
      (c) => new CollectibleInfo(c.position, c.kind),
    );
    const board = new BoardLayout({
      rows: row.rows,
      cols: row.cols,
      arrows,
      walls,
      collectibles,
    });
    const difficulty = DifficultyProfileFactory.create(row.difficulty);
    return new Level({
      id: row.id,
      index: row.index,
      difficulty,
      board,
      parTimeMs: row.parTimeMs,
      timeLimitMs: row.timeLimitMs,
      published: row.published,
    });
  }
  static toPersistence(
    level: Level,
  ): Omit<LevelPersistenceRow, 'createdAt'> {
    return {
      id: level.id,
      index: level.index,
      difficulty: level.difficulty.label(),
      rows: level.board.rows,
      cols: level.board.cols,
      arrows: level.board.arrows.map((a) => a.toJSON()),
      walls: [...level.board.walls],
      collectibles: level.board.collectibles.map((c) => c.toJSON()),
      parTimeMs: level.parTimeMs,
      timeLimitMs: level.timeLimitMs,
      published: level.published,
    };
  }
  private static parseArrows(value: unknown): RawArrow[] {
    if (!Array.isArray(value)) {
      throw new Error('Level arrows column must contain a JSON array');
    }
    return value as RawArrow[];
  }
  private static parseWalls(value: unknown): string[] {
    if (!Array.isArray(value)) {
      throw new Error('Level walls column must contain a JSON array');
    }
    return value as string[];
  }
  private static parseCollectibles(value: unknown): RawCollectible[] {
    if (!Array.isArray(value)) {
      throw new Error(
        'Level collectibles column must contain a JSON array',
      );
    }
    return value as RawCollectible[];
  }
}