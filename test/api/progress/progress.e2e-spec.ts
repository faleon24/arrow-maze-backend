import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';

import { AppModule } from '../../../src/app.module';
import { DomainExceptionFilter } from '../../../src/api/filters/domain-exception.filter';
import { PrismaService } from '../../../src/infrastructure/persistence/prisma.service';
import { DatabaseCleaner } from '../../infrastructure/helpers/database-cleaner';

/**
 * End-to-end tests for the progress endpoints.
 *
 * Boots the entire Nest app and drives it over HTTP. These routes are
 * protected, so every test first registers a user and authenticates
 * with the returned Bearer token — exercising the full chain:
 * JwtAuthGuard -> ProgressController -> use cases -> Postgres.
 *
 * The key properties under test: a run is recorded and read back, the
 * best score is kept across attempts, identity comes from the token
 * (not the body), and the routes reject unauthenticated callers.
 */
describe('Progress endpoints (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cleaner: DatabaseCleaner;

  const registerPayload = {
    email: 'player@example.com',
    password: 'a-strong-password',
    displayName: 'Player One',
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();

    prisma = moduleRef.get(PrismaService);
    cleaner = new DatabaseCleaner(prisma as unknown as PrismaClient);
  });

  afterEach(async () => {
    await cleaner.cleanAll();
  });

  afterAll(async () => {
    await app.close();
  });

  /** Registers a fresh user and returns their Bearer token. */
  async function registerAndGetToken(): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(registerPayload);
    return response.body.token as string;
  }

  const validRun = {
    levelId: 'level-1',
    moves: 12,
    timeMs: 45_000,
    stars: 3,
  };

  describe('authentication', () => {
    it('should_return_401_when_getting_progress_without_a_token', async () => {
      // Act
      const response = await request(app.getHttpServer()).get(
        '/api/me/progress',
      );

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.code).toBe('INVALID_TOKEN');
    });

    it('should_return_401_when_submitting_a_score_without_a_token', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .post('/api/me/progress')
        .send(validRun);

      // Assert
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/me/progress', () => {
    it('should_return_empty_progress_for_a_newly_registered_user', async () => {
      // Arrange
      const token = await registerAndGetToken();

      // Act
      const response = await request(app.getHttpServer())
        .get('/api/me/progress')
        .set('Authorization', `Bearer ${token}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.entries).toEqual([]);
    });
  });

  describe('POST /api/me/progress', () => {
    it('should_record_a_run_and_return_the_updated_progress', async () => {
      // Arrange
      const token = await registerAndGetToken();

      // Act
      const response = await request(app.getHttpServer())
        .post('/api/me/progress')
        .set('Authorization', `Bearer ${token}`)
        .send(validRun);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.entries).toHaveLength(1);
      const entry = response.body.entries[0];
      expect(entry.levelId).toBe('level-1');
      expect(entry.stars).toBe(3);
      expect(entry.attempts).toBe(1);
    });

    it('should_return_400_when_stars_exceed_the_maximum', async () => {
      // Arrange
      const token = await registerAndGetToken();

      // Act
      const response = await request(app.getHttpServer())
        .post('/api/me/progress')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validRun, stars: 5 });

      // Assert
      expect(response.status).toBe(400);
    });

    it('should_keep_the_better_score_across_multiple_submissions', async () => {
      // Arrange
      const token = await registerAndGetToken();

      // Act — a great run, then a worse one on the same level
      await request(app.getHttpServer())
        .post('/api/me/progress')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validRun, stars: 3 });
      await request(app.getHttpServer())
        .post('/api/me/progress')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validRun, stars: 1 });

      // Assert — best score kept, attempts counted
      const response = await request(app.getHttpServer())
        .get('/api/me/progress')
        .set('Authorization', `Bearer ${token}`);
      const entry = response.body.entries[0];
      expect(entry.stars).toBe(3);
      expect(entry.attempts).toBe(2);
    });

    it('should_scope_progress_to_the_authenticated_user', async () => {
      // Arrange — user A records a run
      const tokenA = await registerAndGetToken();
      await request(app.getHttpServer())
        .post('/api/me/progress')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(validRun);

      // A different user registers (clean afterEach means we reuse the
      // same payload; register a second distinct user instead)
      const secondPayload = {
        email: 'other@example.com',
        password: 'another-strong-password',
        displayName: 'Player Two',
      };
      const registerB = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(secondPayload);
      const tokenB = registerB.body.token as string;

      // Act — user B reads their own progress
      const response = await request(app.getHttpServer())
        .get('/api/me/progress')
        .set('Authorization', `Bearer ${tokenB}`);

      // Assert — B sees nothing; A's progress is not theirs
      expect(response.status).toBe(200);
      expect(response.body.entries).toEqual([]);
    });
  });
});