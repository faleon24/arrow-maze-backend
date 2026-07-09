import { SubmitScoreUseCase } from '../../../../src/application/usecases/progress/submit-score.usecase';
import { IProgressRepository } from '../../../../src/application/ports/out/progress-repository.port';
import { IClock } from '../../../../src/application/ports/out/clock.port';
import { PlayerProgress } from '../../../../src/domain/models/player-progress';
import { SubmitScoreCommand } from '../../../../src/application/usecases/progress/submit-score.command';

/**
 * Hand-written fake of IProgressRepository backed by an in-memory map
 * keyed by userId. findByUser returns an empty aggregate for unknown
 * users, matching the real contract. save records what it persisted so
 * tests can assert on it.
 */
class FakeProgressRepository implements IProgressRepository {
  private store = new Map<string, PlayerProgress>();
  public savedProgress: PlayerProgress | null = null;

  seed(progress: PlayerProgress): void {
    this.store.set(progress.userId, progress);
  }

  findByUser(userId: string): Promise<PlayerProgress> {
    return Promise.resolve(this.store.get(userId) ?? new PlayerProgress(userId));
  }

  save(progress: PlayerProgress): Promise<void> {
    this.savedProgress = progress;
    this.store.set(progress.userId, progress);
    return Promise.resolve();
  }
}

/** Clock fixed to a known instant so the recorded time is deterministic. */
class FixedClock implements IClock {
  constructor(private readonly instant: Date) {}
  now(): Date {
    return this.instant;
  }
}

const FIXED_NOW = new Date('2026-03-03T12:00:00.000Z');

function buildCommand(
  overrides: Partial<SubmitScoreCommand> = {},
): SubmitScoreCommand {
  return {
    userId: overrides.userId ?? 'user-1',
    levelId: overrides.levelId ?? 'level-1',
    moves: overrides.moves ?? 10,
    timeMs: overrides.timeMs ?? 60_000,
    stars: overrides.stars ?? 2,
  };
}

describe('SubmitScoreUseCase', () => {
  it('should_record_a_first_attempt_when_the_level_is_new', async () => {
    // Arrange
    const repo = new FakeProgressRepository();
    const useCase = new SubmitScoreUseCase(repo, new FixedClock(FIXED_NOW));

    // Act
    const progress = await useCase.execute(buildCommand({ stars: 2 }));

    // Assert
    const entry = progress.bestFor('level-1');
    expect(entry).not.toBeNull();
    expect(entry!.attempts).toBe(1);
    expect(entry!.bestScore.stars).toBe(2);
  });

  it('should_persist_the_progress_through_the_repository', async () => {
    // Arrange
    const repo = new FakeProgressRepository();
    const useCase = new SubmitScoreUseCase(repo, new FixedClock(FIXED_NOW));

    // Act
    await useCase.execute(buildCommand());

    // Assert
    expect(repo.savedProgress).not.toBeNull();
    expect(repo.savedProgress!.userId).toBe('user-1');
  });

  it('should_stamp_the_completion_with_the_clock_time_not_the_client', async () => {
    // Arrange
    const repo = new FakeProgressRepository();
    const useCase = new SubmitScoreUseCase(repo, new FixedClock(FIXED_NOW));

    // Act
    const progress = await useCase.execute(buildCommand());

    // Assert
    expect(progress.bestFor('level-1')!.completedAt).toEqual(FIXED_NOW);
  });

  it('should_keep_the_better_score_when_a_worse_run_is_submitted', async () => {
    // Arrange
    const repo = new FakeProgressRepository();
    const useCase = new SubmitScoreUseCase(repo, new FixedClock(FIXED_NOW));
    await useCase.execute(buildCommand({ stars: 3 }));

    // Act — a worse run (fewer stars) on the same level
    const progress = await useCase.execute(buildCommand({ stars: 1 }));

    // Assert
    const entry = progress.bestFor('level-1');
    expect(entry!.bestScore.stars).toBe(3);
    expect(entry!.attempts).toBe(2);
  });

  it('should_throw_when_the_score_components_are_invalid', async () => {
    // Arrange
    const repo = new FakeProgressRepository();
    const useCase = new SubmitScoreUseCase(repo, new FixedClock(FIXED_NOW));

    // Act & Assert — 4 stars exceeds the Score maximum
    await expect(useCase.execute(buildCommand({ stars: 4 }))).rejects.toThrow();
  });
});