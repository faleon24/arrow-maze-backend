import { LeaderboardEntry } from '../../../../src/domain/models/leaderboard-entry';
import { ILeaderboardRepository } from '../../../../src/application/ports/out/leaderboard-repository.port';
import { GetMyRankUseCase } from '../../../../src/application/usecases/leaderboard/get-my-rank.usecase';

const entry = () =>
  new LeaderboardEntry({
    userDisplayName: 'Alice',
    stars: 3,
    timeMs: 4_200,
    completedAt: new Date('2026-07-15T10:00:00.000Z'),
  });

class StubRepository implements ILeaderboardRepository {
  public receivedLevelId?: string;
  public receivedUserId?: string;
  constructor(
    private readonly rank: { rank: number; entry: LeaderboardEntry } | null,
  ) {}
  async findTopByLevel(): Promise<LeaderboardEntry[]> {
    return [];
  }
  async findUserRank(
    levelId: string,
    userId: string,
  ): Promise<{ rank: number; entry: LeaderboardEntry } | null> {
    this.receivedLevelId = levelId;
    this.receivedUserId = userId;
    return this.rank;
  }
}

describe('GetMyRankUseCase', () => {
  it('should_return_rank_and_entry_when_user_has_a_run', async () => {
    const mine = { rank: 5, entry: entry() };
    const repo = new StubRepository(mine);
    const useCase = new GetMyRankUseCase(repo);

    const result = await useCase.execute({ levelId: 'lvl-1', userId: 'user-1' });

    expect(result).toBe(mine);
    expect(repo.receivedLevelId).toBe('lvl-1');
    expect(repo.receivedUserId).toBe('user-1');
  });

  it('should_return_null_when_user_has_no_run', async () => {
    const repo = new StubRepository(null);
    const useCase = new GetMyRankUseCase(repo);

    const result = await useCase.execute({ levelId: 'lvl-1', userId: 'ghost' });

    expect(result).toBeNull();
    expect(repo.receivedUserId).toBe('ghost');
  });
});
