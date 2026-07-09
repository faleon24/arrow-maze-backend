import { LevelProgressEntry } from '../../domain/models/level-progress-entry';
import { Score } from '../../domain/models/score';

/**
 * The shape of one progress_entries row as Prisma returns it. Each row
 * corresponds to one (user, level) pair.
 */
export interface ProgressEntryRow {
  id: string;
  userId: string;
  levelId: string;
  moves: number;
  timeMs: number;
  stars: number;
  attempts: number;
  completedAt: Date;
  updatedAt: Date;
}

/**
 * ProgressMapper — Data Mapper between a single LevelProgressEntry and
 * its persistence row.
 *
 * Unlike UserMapper or LevelMapper (which map one aggregate to one
 * row), a PlayerProgress aggregate spans MANY rows — one per level
 * entry. So this mapper works at the entry level: the repository loops
 * over it to assemble or disassemble the aggregate. The score's three
 * components are stored as flat columns (not JSON) so a future
 * leaderboard can ORDER BY them in SQL; toDomain rebuilds the Score
 * value object, re-validating it in the process.
 */
export class ProgressMapper {
  static toDomain(row: ProgressEntryRow): LevelProgressEntry {
    return new LevelProgressEntry({
      levelId: row.levelId,
      bestScore: new Score(row.moves, row.timeMs, row.stars),
      attempts: row.attempts,
      completedAt: row.completedAt,
    });
  }

  /**
   * Flatten one domain entry into the column values for its row. The id
   * and userId are supplied by the repository (which owns identity and
   * knows the aggregate's owner); updatedAt is left to the DB default.
   */
  static toPersistence(
    userId: string,
    id: string,
    entry: LevelProgressEntry,
  ): Omit<ProgressEntryRow, 'updatedAt'> {
    return {
      id,
      userId,
      levelId: entry.levelId,
      moves: entry.bestScore.moves,
      timeMs: entry.bestScore.timeMs,
      stars: entry.bestScore.stars,
      attempts: entry.attempts,
      completedAt: entry.completedAt,
    };
  }
}