import { LeaderboardEntry } from '../../../domain/models/leaderboard-entry';
import { ILeaderboardRepository } from '../../ports/out/leaderboard-repository.port';

export interface GetMyRankQuery {
  levelId: string;
  userId: string;
}

/**
 * MyRank — the authenticated player's standing on one level: their
 * best run (entry) plus its 1-based position (rank) within the level's
 * leaderboard, under the same (stars desc, timeMs asc, completedAt asc)
 * ordering the public leaderboard uses.
 */
export interface MyRank {
  rank: number;
  entry: LeaderboardEntry;
}

/**
 * GetMyRankUseCase — return the authenticated player's rank on a level.
 *
 * Thin coordinator: delegates the "where do I stand?" query to the
 * port. Returns null when the player has no recorded run on the level
 * (they never cleared it), which the API surfaces as an empty body so
 * the client can tell "not played yet" apart from a real ranking.
 *
 * The rank is computed server-side (count of strictly-better runs + 1)
 * so a player can see their true position even when they fall outside
 * the visible top-N. Framework-agnostic: no Nest imports. Wired at the
 * composition root (AppModule) via useFactory, like every other use
 * case.
 */
export class GetMyRankUseCase {
  constructor(private readonly repository: ILeaderboardRepository) {}

  async execute(query: GetMyRankQuery): Promise<MyRank | null> {
    return this.repository.findUserRank(query.levelId, query.userId);
  }
}
