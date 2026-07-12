import { LeaderboardEntry } from '../../../../src/domain/models/leaderboard-entry';
import { ILeaderboardRepository } from '../../../../src/application/ports/out/leaderboard-repository.port';
import { GetLeaderboardUseCase } from '../../../../src/application/usecases/leaderboard/get-leaderboard.usecase';

const entry = (stars: number) =>
  new LeaderboardEntry({
    userDisplayName: 'Alice',
    stars,
    timeMs: 45_000,
    completedAt: new Date('2026-01-01T00:00:00.000Z'),
  });

class StubRepository implements ILeaderboardRepository {
  public receivedLevelId?: string;
  public receivedLimit?: number;

  constructor(private readonly result: LeaderboardEntry[]) {}

  async findTopByLevel(
    levelId: string,
    limit: number,
  ): Promise<LeaderboardEntry[]> {
    this.receivedLevelId = levelId;
    this.receivedLimit = limit;
    return this.result;
  }
}

describe('GetLeaderboardUseCase', () => {
  it('should_forward_query_to_repository_when_limit_is_valid', async () => {
    const rows = [entry(3), entry(2)];
    const repo = new StubRepository(rows);
    const useCase = new GetLeaderboardUseCase(repo);

    const result = await useCase.execute({ levelId: 'lvl-1', limit: 5 });

    expect(result).toBe(rows);
    expect(repo.receivedLevelId).toBe('lvl-1');
    expect(repo.receivedLimit).toBe(5);
  });

  it('should_default_limit_to_ten_when_not_provided', async () => {
    const repo = new StubRepository([]);
    const useCase = new GetLeaderboardUseCase(repo);

    await useCase.execute({ levelId: 'lvl-1' });

    expect(repo.receivedLimit).toBe(10);
  });

  it('should_throw_when_limit_is_zero_or_negative', async () => {
    const useCase = new GetLeaderboardUseCase(new StubRepository([]));

    await expect(
      useCase.execute({ levelId: 'lvl-1', limit: 0 }),
    ).rejects.toThrow(/limit/);
    await expect(
      useCase.execute({ levelId: 'lvl-1', limit: -5 }),
    ).rejects.toThrow(/limit/);
  });

  it('should_throw_when_limit_exceeds_upper_bound', async () => {
    const useCase = new GetLeaderboardUseCase(new StubRepository([]));

    await expect(
      useCase.execute({ levelId: 'lvl-1', limit: 101 }),
    ).rejects.toThrow(/limit/);
  });
});