import { LeaderboardEntry } from '../../../domain/models/leaderboard-entry';
import { ILeaderboardRepository } from '../../ports/out/leaderboard-repository.port';

export interface GetLeaderboardQuery {
  levelId: string;
  limit?: number;
}

/**
 * GetLeaderboardUseCase — return the top N runs for a level.
 *
 * Thin coordinator: normalizes the limit (default 10, bounds 1..100 to
 * avoid pathological queries), then delegates to the port. Ordering is
 * a port contract, not a use-case concern. Level existence is not
 * checked here — an unknown level simply yields an empty array, which
 * the API layer surfaces as 200 with `[]`. If we ever want a 404 for
 * unknown levels we'd inject ILevelRepository here.
 *
 * Framework-agnostic: no Nest imports. Wiring happens at the
 * composition root (AppModule) via useFactory.
 */
export class GetLeaderboardUseCase {
  static readonly DEFAULT_LIMIT = 10;
  static readonly MAX_LIMIT = 100;

  constructor(private readonly repository: ILeaderboardRepository) {}

  async execute(query: GetLeaderboardQuery): Promise<LeaderboardEntry[]> {
    const limit = query.limit ?? GetLeaderboardUseCase.DEFAULT_LIMIT;
    if (
      !Number.isInteger(limit) ||
      limit <= 0 ||
      limit > GetLeaderboardUseCase.MAX_LIMIT
    ) {
      throw new Error(
        `GetLeaderboardUseCase: limit must be an integer in 1..${GetLeaderboardUseCase.MAX_LIMIT}`,
      );
    }
    return this.repository.findTopByLevel(query.levelId, limit);
  }
}