import { Level } from '../../domain/models/level';
import { BoardLayout } from '../../domain/models/board-layout';
import { CellInfo } from '../../domain/models/cell-info';
import { DifficultyProfileFactory } from '../../domain/models/difficulty-profile.factory';

/**
 * The shape of a levels row as Prisma returns it. `cells` is stored as
 * a JSON column, so Prisma types it as `unknown`/`JsonValue`; we accept
 * it loosely here and validate it structurally while mapping to domain.
 */
export interface LevelPersistenceRow {
  id: string;
  index: number;
  difficulty: string;
  rows: number;
  cols: number;
  cells: unknown;
  parTimeMs: number;
  published: boolean;
  createdAt: Date;
}

/**
 * The plain shape of one cell inside the `cells` JSON column.
 */
interface RawCell {
  position: string;
  type: string;
  direction?: string | null;
}

/**
 * LevelMapper — Data Mapper between the Level aggregate and its
 * persistence row.
 *
 * This is the seam where two design decisions pay off:
 *
 *  - toDomain uses DifficultyProfileFactory (the Factory Method) to
 *    turn the stored difficulty label into the right DifficultyProfile
 *    strategy. The persistence layer holds a string; the domain always
 *    holds behavior. The mapper is the single place that bridges them.
 *
 *  - the board is stored as a JSON array of flat cells. toDomain rebuilds
 *    each CellInfo (which re-validates it) and hands them to BoardLayout
 *    (which re-checks the board invariants). So even data that somehow
 *    became corrupt in the database cannot produce an invalid in-memory
 *    board — it fails fast instead.
 *
 * Keeping this translation here (not in the repository) keeps the
 * repository focused on queries only (SRP), exactly like UserMapper.
 */
export class LevelMapper {
  static toDomain(row: LevelPersistenceRow): Level {
    const rawCells = LevelMapper.parseCells(row.cells);

    const cells = rawCells.map(
      (c) => new CellInfo(c.position, c.type, c.direction ?? null),
    );

    const board = new BoardLayout(row.rows, row.cols, cells);
    const difficulty = DifficultyProfileFactory.create(row.difficulty);

    return new Level({
      id: row.id,
      index: row.index,
      difficulty,
      board,
      parTimeMs: row.parTimeMs,
      published: row.published,
    });
  }

  static toPersistence(level: Level): LevelPersistenceRow {
    return {
      id: level.id,
      index: level.index,
      difficulty: level.difficulty.label(),
      rows: level.board.rows,
      cols: level.board.cols,
      cells: level.board.cells.map((c) => c.toJSON()),
      parTimeMs: level.parTimeMs,
      published: level.published,
      // createdAt is assigned by the database default on insert; on
      // update it is left untouched. The repository does not send it.
      createdAt: undefined as unknown as Date,
    };
  }

  // ---------- Private helpers ----------

  private static parseCells(value: unknown): RawCell[] {
    if (!Array.isArray(value)) {
      throw new Error('Level cells column must contain a JSON array');
    }
    return value as RawCell[];
  }
}