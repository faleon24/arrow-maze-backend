import { GetProgressUseCase } from '../../../../src/application/usecases/progress/get-progress.usecase';
import { IProgressRepository } from '../../../../src/application/ports/out/progress-repository.port';
import { PlayerProgress } from '../../../../src/domain/models/player-progress';
import { Score } from '../../../../src/domain/models/score';

class FakeProgressRepository implements IProgressRepository {
  private store = new Map<string, PlayerProgress>();

  seed(progress: PlayerProgress): void {
    this.store.set(progress.userId, progress);
  }

  findByUser(userId: string): Promise<PlayerProgress> {
    return Promise.resolve(this.store.get(userId) ?? new PlayerProgress(userId));
  }

  save(_progress: PlayerProgress): Promise<void> {
    throw new Error('save not expected in this test');
  }
}

describe('GetProgressUseCase', () => {
  it('should_return_the_stored_progress_when_the_user_has_some', async () => {
    // Arrange
    const repo = new FakeProgressRepository();
    const progress = new PlayerProgress('user-1');
    progress.record('level-1', new Score(10, 60_000, 2), new Date());
    repo.seed(progress);
    const useCase = new GetProgressUseCase(repo);

    // Act
    const result = await useCase.execute({ userId: 'user-1' });

    // Assert
    expect(result.entries).toHaveLength(1);
    expect(result.bestFor('level-1')!.bestScore.stars).toBe(2);
  });

  it('should_return_empty_progress_when_the_user_has_none', async () => {
    // Arrange
    const repo = new FakeProgressRepository();
    const useCase = new GetProgressUseCase(repo);

    // Act
    const result = await useCase.execute({ userId: 'newcomer' });

    // Assert
    expect(result.userId).toBe('newcomer');
    expect(result.entries).toHaveLength(0);
  });
});