import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

import { AppModule } from '../../../src/app.module';
import { configureApp } from '../../../src/configure-app';
import { PrismaService } from '../../../src/infrastructure/persistence/prisma.service';
import { DatabaseCleaner } from '../../infrastructure/helpers/database-cleaner';

/**
 * E2E for POST /api/admin/levels.
 *
 * ADMIN_API_KEY is set for the duration of the file so AdminKeyGuard
 * has a known secret to match against. Covers happy-path 204, guard
 * rejections, DTO validation, and the unsolvable-board case (500 from
 * plain Error via DomainExceptionFilter).
 */
const ADMIN_KEY = 'test-admin-key-abc123';

const validBody = () => ({
  id: '22222222-2222-4222-8222-222222222222',
  index: 100,
  difficulty: 'EASY',
  parTimeMs: 60_000,
  timeLimitMs: null,
  published: true,
  board: {
    rows: 1,
    cols: 3,
    arrows: [
      { id: 'a1', color: 'PINK', cells: ['0,0'], direction: 'RIGHT' },
    ],
    walls: [],
    collectibles: [],
  },
});

describe('POST /api/admin/levels (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cleaner: DatabaseCleaner;
  const originalEnv = process.env;

  beforeAll(async () => {
    process.env = { ...originalEnv, ADMIN_API_KEY: ADMIN_KEY };

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    cleaner = new DatabaseCleaner(prisma as unknown as PrismaClient);
  });

  afterEach(async () => {
    await cleaner.cleanAll();
  });

  afterAll(async () => {
    await app.close();
    process.env = originalEnv;
  });

  it('should_create_level_when_key_and_body_are_valid', async () => {
    await request(app.getHttpServer())
      .post('/api/admin/levels')
      .set('X-Admin-Key', ADMIN_KEY)
      .send(validBody())
      .expect(204);

    const stored = await prisma.level.findUnique({
      where: { id: '22222222-2222-4222-8222-222222222222' },
    });
    expect(stored).not.toBeNull();
  });

  it('should_reject_401_when_admin_key_header_is_missing', async () => {
    await request(app.getHttpServer())
      .post('/api/admin/levels')
      .send(validBody())
      .expect(401);
  });

  it('should_reject_401_when_admin_key_is_wrong', async () => {
    await request(app.getHttpServer())
      .post('/api/admin/levels')
      .set('X-Admin-Key', 'this-is-wrong')
      .send(validBody())
      .expect(401);
  });

  it('should_reject_400_when_id_is_not_a_valid_uuid', async () => {
    const body = { ...validBody(), id: 'not-a-uuid' };
    await request(app.getHttpServer())
      .post('/api/admin/levels')
      .set('X-Admin-Key', ADMIN_KEY)
      .send(body)
      .expect(400);
  });

  it('should_return_500_when_board_is_not_solvable', async () => {
    const body = validBody();
    body.board.arrows = [
      { id: 'a1', color: 'PINK', cells: ['0,0'], direction: 'RIGHT' },
      { id: 'a2', color: 'BLUE', cells: ['0,1'], direction: 'LEFT' },
    ];

    // Plain Error → 500 via DomainExceptionFilter. Admin tooling
    // accepts this for now; a dedicated UnsolvableBoardError mapping
    // to 422 could come in a hardening pass.
    await request(app.getHttpServer())
      .post('/api/admin/levels')
      .set('X-Admin-Key', ADMIN_KEY)
      .send(body)
      .expect(500);
  });
});