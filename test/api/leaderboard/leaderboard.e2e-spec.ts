import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

import { ArrowPathInfo } from '../../../src/domain/models/arrow-path-info';
import { BoardLayout } from '../../../src/domain/models/board-layout';
import { EasyProfile } from '../../../src/domain/models/difficulty-profile';
import { Level } from '../../../src/domain/models/level';
import { AppModule } from '../../../src/app.module';
import { configureApp } from '../../../src/configure-app';
import { LEVEL_REPOSITORY } from '../../../src/application/ports/tokens';
import { ILevelRepository } from '../../../src/application/ports/out/level-repository.port';import { PrismaService } from '../../../src/infrastructure/persistence/prisma.service';
import { DatabaseCleaner } from '../../infrastructure/helpers/database-cleaner';
/**
 * E2E for GET /api/leaderboard/:levelId.
 *
 * Boots the real Nest app with configureApp so pipes, filters, and
 * the global prefix behave as in production. Covers ordering, limit
 * bounds, UUID validation, and the empty-list case for an unknown
 * (but valid-shape) level id.
 */
describe('GET /api/leaderboard/:levelId (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let levelRepo: ILevelRepository;
  let cleaner: DatabaseCleaner;

  const LEVEL_ID = '11111111-1111-4111-8111-111111111111';

  const buildSeedLevel = (id: string, index: number): Level =>
    new Level({
      id,
      index,
      difficulty: new EasyProfile(),
      board: new BoardLayout({
        rows: 3,
        cols: 3,
        arrows: [new ArrowPathInfo('a1', 'PINK', ['1,1'], 'UP')],
      }),
      parTimeMs: 60_000,
      published: true,
    });

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    levelRepo = app.get<ILevelRepository>(LEVEL_REPOSITORY);
    cleaner = new DatabaseCleaner(prisma as unknown as PrismaClient);
  });

  beforeEach(async () => {
    await levelRepo.save(buildSeedLevel(LEVEL_ID, 0));
  });

  afterEach(async () => {
    await cleaner.cleanAll();
  });

  afterAll(async () => {
    await app.close();
  });

  const seed = async (
    userId: string,
    displayName: string,
    stars: number,
    timeMs: number,
    completedAt: Date,
  ) => {
    await prisma.user.create({
      data: {
        id: userId,
        email: `${userId}@example.com`,
        passwordHash: 'not-a-real-hash',
        displayName,
      },
    });
    await prisma.progressEntry.create({
      data: {
        id: `entry-${userId}`,
        userId,
        levelId: LEVEL_ID,
        moves: 5,
        timeMs,
        stars,
        attempts: 1,
        completedAt,
      },
    });
  };

  it('should_return_ordered_entries_when_level_has_multiple_runs', async () => {
    await seed('alice', 'Alice', 3, 50_000, new Date('2026-01-01T00:00:00Z'));
    await seed('bob', 'Bob', 2, 30_000, new Date('2026-01-02T00:00:00Z'));

    const response = await request(app.getHttpServer())
      .get(`/api/leaderboard/${LEVEL_ID}`)
      .expect(200);

    expect(response.body).toHaveLength(2);
    expect(response.body[0].userDisplayName).toBe('Alice');
    expect(response.body[0].stars).toBe(3);
    expect(response.body[1].userDisplayName).toBe('Bob');
  });

  it('should_respect_limit_when_query_provides_it', async () => {
    await seed('alice', 'Alice', 3, 10_000, new Date('2026-01-01T00:00:00Z'));
    await seed('bob', 'Bob', 2, 20_000, new Date('2026-01-02T00:00:00Z'));
    await seed('carol', 'Carol', 1, 30_000, new Date('2026-01-03T00:00:00Z'));

    const response = await request(app.getHttpServer())
      .get(`/api/leaderboard/${LEVEL_ID}?limit=2`)
      .expect(200);

    expect(response.body).toHaveLength(2);
  });

  it('should_return_400_when_level_id_is_not_a_valid_uuid', async () => {
    await request(app.getHttpServer())
      .get('/api/leaderboard/not-a-uuid')
      .expect(400);
  });

  it('should_return_400_when_limit_is_out_of_bounds', async () => {
    await request(app.getHttpServer())
      .get(`/api/leaderboard/${LEVEL_ID}?limit=0`)
      .expect(400);
    await request(app.getHttpServer())
      .get(`/api/leaderboard/${LEVEL_ID}?limit=101`)
      .expect(400);
  });

  it('should_return_empty_array_when_level_has_no_runs', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/leaderboard/${LEVEL_ID}`)
      .expect(200);

    expect(response.body).toEqual([]);
  });
});