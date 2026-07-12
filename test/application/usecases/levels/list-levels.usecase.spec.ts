import { ListLevelsUseCase } from '../../../../src/application/usecases/levels/list-levels.usecase';
import { ILevelRepository } from '../../../../src/application/ports/out/level-repository.port';
import { Level } from '../../../../src/domain/models/level';
import { BoardLayout } from '../../../../src/domain/models/board-layout';
import { ArrowPathInfo } from '../../../../src/domain/models/arrow-path-info';
import { EasyProfile } from '../../../../src/domain/models/difficulty-profile';
/**
 * Hand-written fake of ILevelRepository. Only findAllPublished carries
 * behavior for these tests; the other methods satisfy the interface and
 * throw if unexpectedly called, so a test that hits the wrong method
 * fails loudly instead of silently passing.
 */
class FakeLevelRepository implements ILevelRepository {
  private publishedLevels: Level[] = [];
  public findAllPublishedCalls = 0;
  givenPublished(levels: Level[]): void {
    this.publishedLevels = levels;
  }
  findById(_id: string): Promise<Level | null> {
    throw new Error('findById not expected in this test');
  }
  findAll(): Promise<Level[]> {
    throw new Error('findAll not expected in this test');
  }
  findAllPublished(): Promise<Level[]> {
    this.findAllPublishedCalls += 1;
    return Promise.resolve(this.publishedLevels);
  }
  save(_level: Level): Promise<void> {
    throw new Error('save not expected in this test');
  }
}
function buildLevel(index: number): Level {
  const board = new BoardLayout({
    rows: 2,
    cols: 2,
    arrows: [
      new ArrowPathInfo(`a1-${index}`, 'PINK', ['0,0'], 'RIGHT'),
      new ArrowPathInfo(`a2-${index}`, 'BLUE', ['1,1'], 'LEFT'),
    ],
  });
  return new Level({
    id: `level-${index}`,
    index,
    difficulty: new EasyProfile(),
    board,
    parTimeMs: 100_000,
    published: true,
  });
}
describe('ListLevelsUseCase', () => {
  it('should_return_the_published_levels_when_executed', async () => {
    // Arrange
    const repo = new FakeLevelRepository();
    repo.givenPublished([buildLevel(0), buildLevel(1)]);
    const useCase = new ListLevelsUseCase(repo);
    // Act
    const result = await useCase.execute({});
    // Assert
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('level-0');
  });
  it('should_return_an_empty_list_when_no_levels_are_published', async () => {
    // Arrange
    const repo = new FakeLevelRepository();
    repo.givenPublished([]);
    const useCase = new ListLevelsUseCase(repo);
    // Act
    const result = await useCase.execute({});
    // Assert
    expect(result).toEqual([]);
  });
  it('should_delegate_to_the_published_query_and_not_to_findAll', async () => {
    // Arrange
    const repo = new FakeLevelRepository();
    repo.givenPublished([buildLevel(0)]);
    const useCase = new ListLevelsUseCase(repo);
    // Act
    await useCase.execute({});
    // Assert
    expect(repo.findAllPublishedCalls).toBe(1);
  });
});