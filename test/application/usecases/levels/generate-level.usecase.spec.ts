import { GenerateLevelUseCase } from '../../../../src/application/usecases/levels/generate-level.usecase';
import { ArrowPathInfo } from '../../../../src/domain/models/arrow-path-info';
import { BoardLayout } from '../../../../src/domain/models/board-layout';
import { EasyProfile } from '../../../../src/domain/models/difficulty-profile';
import { Level } from '../../../../src/domain/models/level';
import { BoardSolver } from '../../../../src/domain/services/board-solver';
import { RandomBoardGenerator } from '../../../../src/domain/services/random-board-generator';
import { SeededRandomSource } from '../../../../src/domain/services/random-source';
import { IIdGenerator } from '../../../../src/application/ports/out/id-generator.port';
import { ILevelRepository } from '../../../../src/application/ports/out/level-repository.port';

class FakeLevelRepository implements ILevelRepository {
  levels: Level[] = [];
  savedLevels: Level[] = [];

  async findById(id: string): Promise<Level | null> {
    return this.levels.find((l) => l.id === id) ?? null;
  }

  async findAll(): Promise<Level[]> {
    return this.levels;
  }

  async findAllPublished(): Promise<Level[]> {
    return this.levels.filter((l) => l.published);
  }

  async save(level: Level): Promise<void> {
    this.savedLevels.push(level);
    this.levels.push(level);
  }
}

class FakeIdGenerator implements IIdGenerator {
  private counter = 0;
  constructor(private readonly prefix: string = 'gen-') {}
  generate(): string {
    this.counter += 1;
    return `${this.prefix}${this.counter}`;
  }
}

function makeStubLevel(index: number): Level {
  return new Level({
    id: `existing-${index}`,
    index,
    difficulty: new EasyProfile(),
    board: new BoardLayout({
      rows: 2,
      cols: 2,
      arrows: [new ArrowPathInfo('a1', 'PINK', ['0,0'], 'NE')],
    }),
    parTimeMs: 30_000,
    published: true,
  });
}

function buildUseCase(
  repo: FakeLevelRepository,
  idGen: FakeIdGenerator,
  seed = 42,
): GenerateLevelUseCase {
  const generator = new RandomBoardGenerator(
    new BoardSolver(),
    new SeededRandomSource(seed),
  );
  return new GenerateLevelUseCase(repo, generator, idGen);
}

describe('GenerateLevelUseCase', () => {
  describe('execute', () => {
    it('should_generate_and_save_a_solvable_easy_level_when_repo_is_empty', async () => {
      // Arrange
      const repo = new FakeLevelRepository();
      const idGen = new FakeIdGenerator();
      const useCase = buildUseCase(repo, idGen);

      // Act
      const level = await useCase.execute({ difficulty: 'EASY' });

      // Assert
      expect(level.id).toBe('gen-1');
      expect(level.index).toBe(0);
      expect(level.difficulty.label()).toBe('EASY');
      expect(level.published).toBe(true);
      expect(level.board.arrows.length).toBeGreaterThanOrEqual(2);
      expect(repo.savedLevels).toHaveLength(1);
      expect(repo.savedLevels[0].id).toBe('gen-1');
    });

    it('should_assign_next_index_when_catalog_has_existing_levels', async () => {
      // Arrange — three levels already in the repo.
      const repo = new FakeLevelRepository();
      repo.levels = [makeStubLevel(0), makeStubLevel(1), makeStubLevel(2)];
      const idGen = new FakeIdGenerator();
      const useCase = buildUseCase(repo, idGen);

      // Act
      const level = await useCase.execute({ difficulty: 'MEDIUM' });

      // Assert
      expect(level.index).toBe(3);
    });

    it('should_use_id_generator_output_as_level_id', async () => {
      // Arrange
      const repo = new FakeLevelRepository();
      const idGen = new FakeIdGenerator('procedural-');
      const useCase = buildUseCase(repo, idGen);

      // Act
      const level = await useCase.execute({ difficulty: 'EASY' });

      // Assert
      expect(level.id).toBe('procedural-1');
    });

    it('should_scale_par_time_by_arrow_count_and_easy_multiplier', async () => {
      // Arrange — EasyProfile.parTimeMultiplier() === 1.5.
      const repo = new FakeLevelRepository();
      const idGen = new FakeIdGenerator();
      const useCase = buildUseCase(repo, idGen);

      // Act
      const level = await useCase.execute({ difficulty: 'EASY' });

      // Assert
      const expected = Math.floor(level.board.arrows.length * 15_000 * 1.5);
      expect(level.parTimeMs).toBe(expected);
    });

    it('should_scale_par_time_by_arrow_count_and_hard_multiplier', async () => {
      // Arrange — HardProfile.parTimeMultiplier() === 0.75.
      const repo = new FakeLevelRepository();
      const idGen = new FakeIdGenerator();
      const useCase = buildUseCase(repo, idGen, 7);

      // Act
      const level = await useCase.execute({ difficulty: 'HARD' });

      // Assert
      const expected = Math.floor(level.board.arrows.length * 15_000 * 0.75);
      expect(level.parTimeMs).toBe(expected);
    });

    it('should_throw_when_difficulty_label_is_unknown', async () => {
      // Arrange
      const repo = new FakeLevelRepository();
      const idGen = new FakeIdGenerator();
      const useCase = buildUseCase(repo, idGen);

      // Act & Assert
      await expect(
        useCase.execute({ difficulty: 'LEGENDARY' }),
      ).rejects.toThrow(/difficulty/i);
      expect(repo.savedLevels).toHaveLength(0);
    });

    it('should_publish_the_level_by_default_so_the_catalog_sees_it', async () => {
      // Arrange
      const repo = new FakeLevelRepository();
      const idGen = new FakeIdGenerator();
      const useCase = buildUseCase(repo, idGen);

      // Act
      const level = await useCase.execute({ difficulty: 'MEDIUM' });

      // Assert
      expect(level.published).toBe(true);
    });
  });
});
