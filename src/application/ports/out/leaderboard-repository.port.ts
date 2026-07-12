import { LeaderboardEntry } from '../../../domain/models/leaderboard-entry';

/**
 * ILeaderboardRepository — outbound port for reading leaderboard rows.
 *
 * A read-only query family. Separate from IProgressRepository because
 * the leaderboard is cross-user (returns everyone's best runs for one
 * level), whereas IProgressRepository is aggregate-scoped to a single
 * user. Different consumers, different contracts.
 *
 * Implementations MUST return rows sorted by (stars desc, timeMs asc,
 * completedAt asc) — the natural "best-first" ordering the use case
 * relies on. That ordering lives in the SQL/adapter, not in the
 * use case, because SQL is faster at ORDER BY than JavaScript.
 */
export interface ILeaderboardRepository {
  findTopByLevel(levelId: string, limit: number): Promise<LeaderboardEntry[]>;
}