import { INestApplication } from '@nestjs/common';import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';

import { AppModule } from '../../../src/app.module';
import { configureApp } from '../../../src/configure-app';import { PrismaService } from '../../../src/infrastructure/persistence/prisma.service';
import { PostgresLevelRepository } from '../../../src/infrastructure/persistence/postgres-level.repository';
import { DatabaseCleaner } from '../../infrastructure/helpers/database-cleaner';

import { Level } from '../../../src/domain/models/level';
import { BoardLayout } from '../../../src/domain/models/board-layout';
import { CellInfo } from '../../../src/domain/models/cell-info';
import {
  DifficultyProfile,
  EasyProfile,
  HardProfile,
} from '../../../src/domain/models/difficulty-profile';

/**
 * End-to-end tests for the level catalog endpoint.
 *
 * Boots the ENTIRE Nest application and drives it over HTTP with
 * supertest. Every layer participates: LevelsController -> the
 * logging-decorated ListLevelsUseCase -> PostgresLevelRepository ->
 * LevelMapper (which runs the DifficultyProfileFactory) -> Postgres.
 *
 * Levels are seeded through the REAL repository, not raw SQL, so the
 * data under test travels the exact same write path a running server
 * would use. The app is configured here exactly as in main.ts so the
 * tests observe production behaviour.
 *
 * Safety: the shared jest-integration.setup.ts guard refuses to run
 * unless DATABASE_URL points at arrowmaze_test.
 */
describe('Levels endpoints (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cleaner: DatabaseCleaner;
  let levels: PostgresLevelRepository;

  const buildBoard = (): BoardLayout =>
    new BoardLayout(3, 3, [
      new CellInfo('0,0', 'EMPTY'),
      new CellInfo('1,1', 'ARROW', 'DOWN'),
      new CellInfo('2,2', 'EMPTY'),
    ]);

  const buildLevel = (
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
      difficulty: overrides.difficulty ?? new EasyProfile(),
      board: buildBoard(),
      parTimeMs: overrides.parTimeMs ?? 100_000,
      published: overrides.published ?? true,
    });

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

   app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = moduleRef.get(PrismaService);
    cleaner = new DatabaseCleaner(prisma as unknown as PrismaClient);
    levels = new PostgresLevelRepository(prisma);
  });

  afterEach(async () => {
    await cleaner.cleanAll();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/levels', () => {
    it('should_return_200_with_an_empty_array_when_no_levels_are_published', async () => {
      // Act
      const response = await request(app.getHttpServer()).get('/api/levels');

      // Assert
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(0);
    });

    it('should_return_a_published_level_with_its_full_structure', async () => {
      // Arrange
      await levels.save(buildLevel({ published: true }));

      // Act
      const response = await request(app.getHttpServer()).get('/api/levels');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);

      const level = response.body[0];
      expect(level.id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(level.index).toBe(0);
      expect(level.difficulty).toBe('EASY');
      expect(level.published).toBe(true);
      expect(level.board.rows).toBe(3);
      expect(level.board.cols).toBe(3);
      expect(level.board.cells).toHaveLength(3);
    });

    it('should_exclude_unpublished_levels_from_the_catalog', async () => {
      // Arrange
      await levels.save(
        buildLevel({
          id: '11111111-1111-1111-1111-111111111111',
          index: 0,
          published: true,
        }),
      );
      await levels.save(
        buildLevel({
          id: '22222222-2222-2222-2222-222222222222',
          index: 1,
          published: false,
        }),
      );

      // Act
      const response = await request(app.getHttpServer()).get('/api/levels');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe('11111111-1111-1111-1111-111111111111');
    });

    it('should_order_published_levels_by_index', async () => {
      // Arrange — insert out of order
      await levels.save(
        buildLevel({
          id: '33333333-3333-3333-3333-333333333333',
          index: 2,
          published: true,
        }),
      );
      await levels.save(
        buildLevel({
          id: '11111111-1111-1111-1111-111111111111',
          index: 0,
          published: true,
        }),
      );
      await levels.save(
        buildLevel({
          id: '22222222-2222-2222-2222-222222222222',
          index: 1,
          published: true,
        }),
      );

      // Act
      const response = await request(app.getHttpServer()).get('/api/levels');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.map((l: { index: number }) => l.index)).toEqual([
        0, 1, 2,
      ]);
    });

    it('should_preserve_the_arrow_direction_through_the_http_response', async () => {
      // Arrange
      await levels.save(buildLevel({ published: true }));

      // Act
      const response = await request(app.getHttpServer()).get('/api/levels');

      // Assert
      const arrow = response.body[0].board.cells.find(
        (c: { type: string }) => c.type === 'ARROW',
      );
      expect(arrow).toBeDefined();
      expect(arrow.direction).toBe('DOWN');
    });

    it('should_expose_the_effective_par_time_with_difficulty_applied', async () => {
      // Arrange — HardProfile multiplier is 0.75; base 100_000 -> 75_000
      await levels.save(
        buildLevel({ difficulty: new HardProfile(), parTimeMs: 100_000 }),
      );

      // Act
      const response = await request(app.getHttpServer()).get('/api/levels');

      // Assert
      expect(response.body[0].difficulty).toBe('HARD');
      expect(response.body[0].parTimeMs).toBe(75_000);
    });
  });
});