import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { configureApp } from '../../../src/configure-app';
import { PrismaService } from '../../../src/infrastructure/persistence/prisma.service';
import { PostgresLevelRepository } from '../../../src/infrastructure/persistence/postgres-level.repository';
import { Level } from '../../../src/domain/models/level';
import { BoardLayout } from '../../../src/domain/models/board-layout';
import { ArrowPathInfo } from '../../../src/domain/models/arrow-path-info';
import { EasyProfile } from '../../../src/domain/models/difficulty-profile';
import { DatabaseCleaner } from '../../infrastructure/helpers/database-cleaner';
/**
 * End-to-end tests for the progress endpoints (v2, server-authoritative
 * scoring).
 *
 * Every write chain is exercised over HTTP: JwtAuthGuard ->
 * ProgressController -> SubmitScoreUseCase -> Postgres. Since v2, the
 * DTO drops `stars` (server computes them), rejects non-UUID levelIds
 * at the pipe, and the use case 404s on unknown or unpublished levels.
 *
 * The Level fixture (EasyProfile, 60_000 ms parTime) is seeded per
 * test so ProgressEntry FKs resolve. EasyProfile thresholds: 3 stars
 * ≤ 120_000 ms, 2 stars ≤ 240_000 ms, otherwise 1 star.
 */
describe('Progress endpoints (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let levels: PostgresLevelRepository;
  let cleaner: DatabaseCleaner;
  const LEVEL_UUID = '550e8400-e29b-41d4-a716-446655440000';
  const registerPayload = {
    email: 'player@example.com',
    password: 'a-strong-password',
    displayName: 'Player One',
  };
  const validRun = {
    levelId: LEVEL_UUID,
    moves: 1,
    timeMs: 45_000,
  };
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
    prisma = moduleRef.get(PrismaService);
    levels = new PostgresLevelRepository(prisma);
    cleaner = new DatabaseCleaner(prisma as unknown as PrismaClient);
  });
  beforeEach(async () => {
    // Seed the Level that validRun.levelId references so the FK holds
    // when the app writes a ProgressEntry. Cleaner wipes it in
    // afterEach, so we reseed per test.
    await levels.save(buildSeedLevel(LEVEL_UUID, 0));
  });
  afterEach(async () => {
    await cleaner.cleanAll();
  });
  afterAll(async () => {
    await app.close();
  });
  async function registerAndGetToken(): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(registerPayload);
    return response.body.token as string;
  }
  describe('authentication', () => {
    it('should_return_401_when_getting_progress_without_a_token', async () => {
      const response = await request(app.getHttpServer()).get(
        '/api/me/progress',
      );
      expect(response.status).toBe(401);
      expect(response.body.code).toBe('INVALID_TOKEN');
    });
    it('should_return_401_when_submitting_a_score_without_a_token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/me/progress')
        .send(validRun);
      expect(response.status).toBe(401);
    });
  });
  describe('GET /api/me/progress', () => {
    it('should_return_empty_progress_for_a_newly_registered_user', async () => {
      const token = await registerAndGetToken();
      const response = await request(app.getHttpServer())
        .get('/api/me/progress')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body.entries).toEqual([]);
    });
  });
  describe('POST /api/me/progress', () => {
    it('should_record_a_run_and_return_the_updated_progress', async () => {
      const token = await registerAndGetToken();
      const response = await request(app.getHttpServer())
        .post('/api/me/progress')
        .set('Authorization', `Bearer ${token}`)
        .send(validRun);
      expect(response.status).toBe(200);
      expect(response.body.entries).toHaveLength(1);
      const entry = response.body.entries[0];
      expect(entry.levelId).toBe(LEVEL_UUID);
      // 45_000ms on EasyProfile (3-star threshold 120_000) → 3 stars.
      expect(entry.stars).toBe(3);
      expect(entry.attempts).toBe(1);
    });
    it('should_return_400_when_the_client_sends_stars_in_the_body', async () => {
      // The DTO forbids `stars` entirely; ValidationPipe's
      // forbidNonWhitelisted flag rejects extra fields. Closes the
      // security hole where a client could claim any star count.
      const token = await registerAndGetToken();
      const response = await request(app.getHttpServer())
        .post('/api/me/progress')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validRun, stars: 3 });
      expect(response.status).toBe(400);
    });
    it('should_return_400_when_the_levelId_is_not_a_uuid', async () => {
      const token = await registerAndGetToken();
      const response = await request(app.getHttpServer())
        .post('/api/me/progress')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validRun, levelId: 'not-a-uuid' });
      expect(response.status).toBe(400);
    });
    it('should_return_404_when_the_level_does_not_exist', async () => {
      const token = await registerAndGetToken();
      const unknownUuid = '99999999-9999-4999-8999-999999999999';
      const response = await request(app.getHttpServer())
        .post('/api/me/progress')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validRun, levelId: unknownUuid });
      expect(response.status).toBe(404);
    });
    it('should_keep_the_better_score_across_multiple_submissions', async () => {
      const token = await registerAndGetToken();
      // Fast run → 3 stars on EasyProfile
      await request(app.getHttpServer())
        .post('/api/me/progress')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validRun, timeMs: 45_000 });
      // Slow run → 1 star on EasyProfile (over 240s)
      await request(app.getHttpServer())
        .post('/api/me/progress')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validRun, timeMs: 300_000 });
      const response = await request(app.getHttpServer())
        .get('/api/me/progress')
        .set('Authorization', `Bearer ${token}`);
      const entry = response.body.entries[0];
      expect(entry.stars).toBe(3);
      expect(entry.attempts).toBe(2);
    });
    it('should_scope_progress_to_the_authenticated_user', async () => {
      const tokenA = await registerAndGetToken();
      await request(app.getHttpServer())
        .post('/api/me/progress')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(validRun);
      const secondPayload = {
        email: 'other@example.com',
        password: 'another-strong-password',
        displayName: 'Player Two',
      };
      const registerB = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(secondPayload);
      const tokenB = registerB.body.token as string;
      const response = await request(app.getHttpServer())
        .get('/api/me/progress')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(response.status).toBe(200);
      expect(response.body.entries).toEqual([]);
    });
  });
});