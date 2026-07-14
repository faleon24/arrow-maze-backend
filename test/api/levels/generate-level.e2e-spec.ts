import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';

import { AppModule } from '../../../src/app.module';
import { configureApp } from '../../../src/configure-app';
import { PrismaService } from '../../../src/infrastructure/persistence/prisma.service';
import { DatabaseCleaner } from '../../infrastructure/helpers/database-cleaner';

/**
 * End-to-end tests for POST /api/levels/generate.
 *
 * Boots the whole app and drives the endpoint over HTTP. Verifies:
 *   - a valid difficulty produces a persisted, catalog-visible level;
 *   - invalid or missing difficulty is rejected at the validation seam
 *     (400) before the use case runs;
 *   - successive generations assign contiguous 0-based indices.
 */
describe('Generate level endpoint (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cleaner: DatabaseCleaner;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
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

  describe('POST /api/levels/generate', () => {
    it('should_return_201_with_a_solvable_easy_level_when_difficulty_is_easy', async () => {
      // Act
      const res = await request(app.getHttpServer())
        .post('/api/levels/generate')
        .send({ difficulty: 'EASY' });

      // Assert
      expect(res.status).toBe(201);
      expect(res.body.id).toBeTruthy();
      expect(res.body.difficulty).toBe('EASY');
      expect(res.body.published).toBe(true);
      expect(res.body.board.version).toBe(2);
      expect(res.body.board.arrows.length).toBeGreaterThanOrEqual(2);
    });

    it('should_persist_the_level_so_it_appears_in_the_public_catalog', async () => {
      // Arrange & Act — generate one, then list.
      await request(app.getHttpServer())
        .post('/api/levels/generate')
        .send({ difficulty: 'MEDIUM' });

      const listRes = await request(app.getHttpServer()).get('/api/levels');

      // Assert
      expect(listRes.status).toBe(200);
      expect(listRes.body).toHaveLength(1);
      expect(listRes.body[0].difficulty).toBe('MEDIUM');
    });

    it('should_assign_contiguous_indices_when_called_multiple_times', async () => {
      // Act — three generations.
      const r1 = await request(app.getHttpServer())
        .post('/api/levels/generate')
        .send({ difficulty: 'EASY' });
      const r2 = await request(app.getHttpServer())
        .post('/api/levels/generate')
        .send({ difficulty: 'EASY' });
      const r3 = await request(app.getHttpServer())
        .post('/api/levels/generate')
        .send({ difficulty: 'HARD' });

      // Assert
      expect(r1.body.index).toBe(0);
      expect(r2.body.index).toBe(1);
      expect(r3.body.index).toBe(2);
    });

    it('should_return_400_when_difficulty_is_not_in_the_whitelist', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/levels/generate')
        .send({ difficulty: 'LEGENDARY' });

      expect(res.status).toBe(400);
    });

    it('should_return_400_when_difficulty_is_missing_from_the_body', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/levels/generate')
        .send({});

      expect(res.status).toBe(400);
    });
  });
});
