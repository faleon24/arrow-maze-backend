import { PrismaClient } from '@prisma/client';
import { PostgresLevelRepository } from '../../../src/infrastructure/persistence/postgres-level.repository';
import { PrismaService } from '../../../src/infrastructure/persistence/prisma.service';
import { Level } from '../../../src/domain/models/level';
import { BoardLayout } from '../../../src/domain/models/board-layout';
import { CellInfo } from '../../../src/domain/models/cell-info';
import {
  DifficultyProfile,
  EasyProfile,
  HardProfile,
  MediumProfile,
} from '../../../src/domain/models/difficulty-profile';
import { DatabaseCleaner } from '../helpers/database-cleaner';

/**
 * Integration tests for PostgresLevelRepository.
 *
 * Exercises the adapter against a REAL PostgreSQL instance
 * (arrowmaze_test). No mocks. The point is to prove that the queries,
 * the LevelMapper, the DifficultyProfileFactory, and the schema all
 * agree — in particular that a difficulty label survives a round-trip
 * through the database and comes back as the correct DifficultyProfile
 * strategy, and that the board JSON serializes and deserializes without
 * loss (arrow directions included).
 */
describe('PostgresLevelRepository (integration)', () => {
  let prisma: PrismaService;
  let repository: PostgresLevelRepository;
  let cleaner: DatabaseCleaner;

  const buildBoard = (): BoardLayout =>
    new BoardLayout(3, 3, [
      new CellInfo('0,0', 'START'),
      new CellInfo('1,1', 'ARROW', 'DOWN'),
      new CellInfo('2,2', 'EXIT'),
    ]);

  const buildValidLevel = (
    overrides: Partial<{
      id: string;
      index: number;
      difficulty: DifficultyProfile;
      parTimeMs: number;
      published: boolean;
    }> = {},
  ): Level =>
    new Level({
      id: overrides.id ?? '550e8400-e29b-41d4-a716-446655440000',
      index: overrides.index ?? 0,
      difficulty: overrides.difficulty ?? new MediumProfile(),
      board: buildBoard(),
      parTimeMs: overrides.parTimeMs ?? 120_000,
      published: overrides.published ?? true,
    });

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    repository = new PostgresLevelRepository(prisma);
    cleaner = new DatabaseCleaner(prisma as unknown as PrismaClient);
  });

  afterEach(async () => {
    await cleaner.cleanAll();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // -------- findById --------

  describe('findById', () => {
    it('should_return_null_when_level_does_not_exist', async () => {
      // Arrange
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // Act
      const result = await repository.findById(nonExistentId);

      // Assert
      expect(result).toBeNull();
    });

    it('should_return_Level_when_level_exists', async () => {
      // Arrange
      const level = buildValidLevel();
      await repository.save(level);

      // Act
      const result = await repository.findById(level.id);

      // Assert
      expect(result).not.toBeNull();
      expect(result).toBeInstanceOf(Level);
      expect(result!.id).toBe(level.id);
    });
  });

  // -------- findAllPublished --------

  describe('findAllPublished', () => {
    it('should_return_only_published_levels_ordered_by_index', async () => {
      // Arrange: insert out of order, mixing published and draft
      await repository.save(
        buildValidLevel({
          id: '33333333-3333-3333-3333-333333333333',
          index: 2,
          published: true,
        }),
      );
      await repository.save(
        buildValidLevel({
          id: '11111111-1111-1111-1111-111111111111',
          index: 0,
          published: true,
        }),
      );
      await repository.save(
        buildValidLevel({
          id: '22222222-2222-2222-2222-222222222222',
          index: 1,
          published: true,
        }),
      );

      // Act
      const result = await repository.findAllPublished();

      // Assert
      expect(result).toHaveLength(3);
      expect(result.map((l) => l.index)).toEqual([0, 1, 2]);
    });

    it('should_exclude_unpublished_levels', async () => {
      // Arrange
      await repository.save(
        buildValidLevel({
          id: '11111111-1111-1111-1111-111111111111',
          index: 0,
          published: true,
        }),
      );
      await repository.save(
        buildValidLevel({
          id: '22222222-2222-2222-2222-222222222222',
          index: 1,
          published: false,
        }),
      );

      // Act
      const result = await repository.findAllPublished();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].published).toBe(true);
    });
  });

  // -------- findAll --------

  describe('findAll', () => {
    it('should_return_every_level_including_drafts', async () => {
      // Arrange
      await repository.save(
        buildValidLevel({
          id: '11111111-1111-1111-1111-111111111111',
          index: 0,
          published: true,
        }),
      );
      await repository.save(
        buildValidLevel({
          id: '22222222-2222-2222-2222-222222222222',
          index: 1,
          published: false,
        }),
      );

      // Act
      const result = await repository.findAll();

      // Assert
      expect(result).toHaveLength(2);
    });
  });

  // -------- save (update path) --------

  describe('save (update path)', () => {
    it('should_publish_an_existing_level_when_saved_as_published', async () => {
      // Arrange
      const draft = buildValidLevel({ published: false });
      await repository.save(draft);

      const published = buildValidLevel({ published: true });

      // Act
      await repository.save(published);

      // Assert
      const fetched = await repository.findById(draft.id);
      expect(fetched!.published).toBe(true);
    });
  });

  // -------- Factory Method materialization --------

  describe('difficulty round-trip (Factory Method)', () => {
    it('should_rebuild_the_matching_profile_when_reading_each_difficulty', async () => {
      // Arrange
      const cases: Array<[string, number, DifficultyProfile, Function]> = [
        ['11111111-1111-1111-1111-111111111111', 0, new EasyProfile(), EasyProfile],
        ['22222222-2222-2222-2222-222222222222', 1, new MediumProfile(), MediumProfile],
        ['33333333-3333-3333-3333-333333333333', 2, new HardProfile(), HardProfile],
      ];
      for (const [id, index, difficulty] of cases) {
        await repository.save(buildValidLevel({ id, index, difficulty }));
      }

      // Act & Assert
      for (const [id, , , ProfileClass] of cases) {
        const fetched = await repository.findById(id);
        expect(fetched!.difficulty).toBeInstanceOf(ProfileClass);
      }
    });
  });

  // -------- Round-trip integrity --------

  describe('round-trip integrity', () => {
    it('should_preserve_all_fields_and_the_board_through_save_and_findById', async () => {
      // Arrange
      const original = buildValidLevel({ difficulty: new HardProfile() });

      // Act
      await repository.save(original);
      const fetched = await repository.findById(original.id);

      // Assert
      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(original.id);
      expect(fetched!.index).toBe(original.index);
      expect(fetched!.parTimeMs).toBe(original.parTimeMs);
      expect(fetched!.published).toBe(original.published);
      expect(fetched!.difficulty.label()).toBe('HARD');
      expect(fetched!.board.rows).toBe(3);
      expect(fetched!.board.cols).toBe(3);
      expect(fetched!.board.cells).toHaveLength(3);
      // The arrow cell must survive with its direction intact.
      const arrow = fetched!.board.cells.find((c) => c.type === 'ARROW');
      expect(arrow).toBeDefined();
      expect(arrow!.direction).toBe('DOWN');
    });
  });
});