import { LeaderboardEntry } from '../../../domain/models/leaderboard-entry';

/**
 * ILeaderboardRepository — outbound port for reading leaderboard rows.
 *
 * A read-only query family. Separate from IProgressRepository because
 * the leaderboard is cross-user (returns everyone's best runs for one
 * level), whereas IProgressRepository is aggregate-scoped to a single
 * user. Different consumers, different contracts.
 *
 * Implementations MUST order by (stars desc, timeMs asc, completedAt
 * asc) — the natural "best-first" ordering the use cases rely on. That
 * ordering lives in the SQL/adapter, not in the use case, because SQL
 * is faster at ORDER BY than JavaScript.
 */
export interface ILeaderboardRepository {
  /**
   * Top `limit` runs for `levelId`, best-first.
   */
  findTopByLevel(levelId: string, limit: number): Promise<LeaderboardEntry[]>;

  /**
   * The `userId`'s best run for `levelId` together with its 1-based
   * rank under the same ordering, or null when the user has no run on
   * the level. The rank is derived by counting strictly-better runs,
   * so it stays correct even when the user is outside any top-N slice.
   */
  findUserRank(
    levelId: string,
    userId: string,
  ): Promise<{ rank: number; entry: LeaderboardEntry } | null>;
}
