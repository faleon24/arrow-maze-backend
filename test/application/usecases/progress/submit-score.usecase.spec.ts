import { SubmitScoreUseCase } from '../../../../src/application/usecases/progress/submit-score.usecase';
import { IProgressRepository } from '../../../../src/application/ports/out/progress-repository.port';
import { ILevelRepository } from '../../../../src/application/ports/out/level-repository.port';
import { IClock } from '../../../../src/application/ports/out/clock.port';
import { PlayerProgress } from '../../../../src/domain/models/player-progress';
import { Level } from '../../../../src/domain/models/level';
import { BoardLayout } from '../../../../src/domain/models/board-layout';
import { ArrowPathInfo } from '../../../../src/domain/models/arrow-path-info';
import { EasyProfile } from '../../../../src/domain/models/difficulty-profile';
import { LevelNotFoundError } from '../../../../src/domain/errors/level-not-found.error';
import { SubmitScoreCommand } from '../../../../src/application/usecases/progress/submit-score.command';

class FakeProgressRepository implements IProgressRepository {
  private store = new Map<string, PlayerProgress>();
  public savedProgress: PlayerProgress | null = null;
  findByUser(userId: string): Promise<PlayerProgress> {
    return Promise.resolve(this.store.get(userId) ?? new PlayerProgress(userId));
  }
  save(progress: PlayerProgress): Promise<void> {
    this.savedProgress = progress;
    this.store.set(progress.userId, progress);
    return Promise.resolve();
  }
}

class FakeLevelRepository implements ILevelRepository {
  private levels = new Map<string, Level>();
  seed(level: Level): void {
    this.levels.set(level.id, level);
  }
  findById(id: string): Promise<Level | null> {
    return Promise.resolve(this.levels.get(id) ?? null);
  }
  findAll(): Promise<Level[]> {
    throw new Error('findAll not expected in this test');
  }
  findAllPublished(): Promise<Level[]> {
    throw new Error('findAllPublished not expected in this test');
  }
  save(_level: Level): Promise<void> {
    throw new Error('save not expected in this test');
  }
}

class FixedClock implements IClock {
  constructor(private readonly instant: Date) {}
  now(): Date {
    return this.instant;
  }
}

const FIXED_NOW = new Date('2026-03-03T12:00:00.000Z');

function buildLevel(
  overrides: Partial<{ id: string; published: boolean }> = {},
): Level {
  return new Level({
    id: overrides.id ?? 'level-1',
    index: 0,
    difficulty: new EasyProfile(),
    board: new BoardLayout({
      rows: 3,
      cols: 3,
      arrows: [new ArrowPathInfo('a1', 'PINK', ['1,1'], 'UP')],
    }),
    parTimeMs: 60_000,
    published: overrides.published ?? true,
  });
}

function buildCommand(
  overrides: Partial<SubmitScoreCommand> = {},
): SubmitScoreCommand {
  return {
    userId: overrides.userId ?? 'user-1',
    levelId: overrides.levelId ?? 'level-1',
    moves: overrides.moves ?? 1,
    timeMs: overrides.timeMs ?? 60_000,
  };
}

describe('SubmitScoreUseCase', () => {
  it('should_award_full_stars_when_no_blocked_taps_and_fast_time', async () => {
    // Arrange — 1 arrow, moves=1 (no blocks), 60s on Easy (<=120s).
    const progressRepo = new FakeProgressRepository();
    const levelRepo = new FakeLevelRepository();
    levelRepo.seed(buildLevel());
    const useCase = new SubmitScoreUseCase(
      progressRepo,
      new FixedClock(FIXED_NOW),
      levelRepo,
    );
    // Act
    const progress = await useCase.execute(
      buildCommand({ moves: 1, timeMs: 60_000 }),
    );
    // Assert
    const entry = progress.bestFor('level-1');
    expect(entry).not.toBeNull();
    expect(entry!.attempts).toBe(1);
    expect(entry!.bestScore.stars).toBe(3);
  });

  it('should_reduce_stars_by_blocked_taps_when_moves_exceed_arrow_count', async () => {
    // Arrange — 1 arrow, moves=3 → 2 blocked taps → movesBased = 1.
    const progressRepo = new FakeProgressRepository();
    const levelRepo = new FakeLevelRepository();
    levelRepo.seed(buildLevel());
    const useCase = new SubmitScoreUseCase(
      progressRepo,
      new FixedClock(FIXED_NOW),
      levelRepo,
    );
    // Act
    const progress = await useCase.execute(
      buildCommand({ moves: 3, timeMs: 60_000 }),
    );
    // Assert — 2 blocked taps caps stars at 1 regardless of fast time.
    expect(progress.bestFor('level-1')!.bestScore.stars).toBe(1);
  });

  it('should_award_two_stars_when_exactly_one_blocked_tap_and_fast_time', async () => {
    // Arrange — 1 arrow, moves=2 → 1 blocked → movesBased=2.
    const progressRepo = new FakeProgressRepository();
    const levelRepo = new FakeLevelRepository();
    levelRepo.seed(buildLevel());
    const useCase = new SubmitScoreUseCase(
      progressRepo,
      new FixedClock(FIXED_NOW),
      levelRepo,
    );
    // Act
    const progress = await useCase.execute(
      buildCommand({ moves: 2, timeMs: 60_000 }),
    );
    // Assert
    expect(progress.bestFor('level-1')!.bestScore.stars).toBe(2);
  });

  it('should_take_worst_of_moves_and_time_when_both_are_suboptimal', async () => {
    // Arrange — 1 blocked tap (movesBased=2) AND slow time (Easy
    // returns 1 star for 300s). min(2, 1) = 1.
    const progressRepo = new FakeProgressRepository();
    const levelRepo = new FakeLevelRepository();
    levelRepo.seed(buildLevel());
    const useCase = new SubmitScoreUseCase(
      progressRepo,
      new FixedClock(FIXED_NOW),
      levelRepo,
    );
    // Act
    const progress = await useCase.execute(
      buildCommand({ moves: 2, timeMs: 300_000 }),
    );
    // Assert
    expect(progress.bestFor('level-1')!.bestScore.stars).toBe(1);
  });

  it('should_persist_the_progress_through_the_repository', async () => {
    const progressRepo = new FakeProgressRepository();
    const levelRepo = new FakeLevelRepository();
    levelRepo.seed(buildLevel());
    const useCase = new SubmitScoreUseCase(
      progressRepo,
      new FixedClock(FIXED_NOW),
      levelRepo,
    );
    await useCase.execute(buildCommand());
    expect(progressRepo.savedProgress).not.toBeNull();
    expect(progressRepo.savedProgress!.userId).toBe('user-1');
  });

  it('should_stamp_the_completion_with_the_clock_time_not_the_client', async () => {
    const progressRepo = new FakeProgressRepository();
    const levelRepo = new FakeLevelRepository();
    levelRepo.seed(buildLevel());
    const useCase = new SubmitScoreUseCase(
      progressRepo,
      new FixedClock(FIXED_NOW),
      levelRepo,
    );
    const progress = await useCase.execute(buildCommand());
    expect(progress.bestFor('level-1')!.completedAt).toEqual(FIXED_NOW);
  });

  it('should_keep_the_better_score_when_a_slower_run_is_submitted', async () => {
    // Arrange
    const progressRepo = new FakeProgressRepository();
    const levelRepo = new FakeLevelRepository();
    levelRepo.seed(buildLevel());
    const useCase = new SubmitScoreUseCase(
      progressRepo,
      new FixedClock(FIXED_NOW),
      levelRepo,
    );
    // Act — first run clean (3 stars), then messy (1 star).
    await useCase.execute(buildCommand({ moves: 1, timeMs: 60_000 }));
    const progress = await useCase.execute(
      buildCommand({ moves: 10, timeMs: 300_000 }),
    );
    // Assert — best of 3 stars kept, both attempts counted.
    const entry = progress.bestFor('level-1');
    expect(entry!.bestScore.stars).toBe(3);
    expect(entry!.attempts).toBe(2);
  });

  it('should_throw_LevelNotFoundError_when_the_level_does_not_exist', async () => {
    const progressRepo = new FakeProgressRepository();
    const levelRepo = new FakeLevelRepository();
    const useCase = new SubmitScoreUseCase(
      progressRepo,
      new FixedClock(FIXED_NOW),
      levelRepo,
    );
    await expect(
      useCase.execute(buildCommand({ levelId: 'ghost' })),
    ).rejects.toBeInstanceOf(LevelNotFoundError);
  });

  it('should_throw_LevelNotFoundError_when_the_level_exists_but_is_unpublished', async () => {
    const progressRepo = new FakeProgressRepository();
    const levelRepo = new FakeLevelRepository();
    levelRepo.seed(buildLevel({ id: 'draft', published: false }));
    const useCase = new SubmitScoreUseCase(
      progressRepo,
      new FixedClock(FIXED_NOW),
      levelRepo,
    );
    await expect(
      useCase.execute(buildCommand({ levelId: 'draft' })),
    ).rejects.toBeInstanceOf(LevelNotFoundError);
  });
});
