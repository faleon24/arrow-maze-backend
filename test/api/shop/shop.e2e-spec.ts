import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

import { AppModule } from '../../../src/app.module';
import { configureApp } from '../../../src/configure-app';
import { PrismaService } from '../../../src/infrastructure/persistence/prisma.service';
import { DatabaseCleaner } from '../../infrastructure/helpers/database-cleaner';

describe('GET /api/shop (e2e)', () => {
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

    prisma = app.get(PrismaService);
    cleaner = new DatabaseCleaner(prisma as unknown as PrismaClient);
  });

  afterEach(async () => {
    await cleaner.cleanAll();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should_return_empty_array_when_catalog_is_empty', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/shop')
      .expect(200);

    expect(response.body).toEqual([]);
  });

  it('should_return_items_ordered_by_kind_then_name', async () => {
    await prisma.shopItem.createMany({
      data: [
        { id: 'i1', name: 'Zeta Theme', costCoins: 10, kind: 'COSMETIC' },
        { id: 'i2', name: 'Alpha Boost', costCoins: 50, kind: 'POWERUP' },
        { id: 'i3', name: 'Beta Theme', costCoins: 15, kind: 'COSMETIC' },
      ],
    });

    const response = await request(app.getHttpServer())
      .get('/api/shop')
      .expect(200);

    expect(response.body).toHaveLength(3);
    // COSMETIC before POWERUP; within kind, alphabetical by name.
    expect(response.body[0].name).toBe('Beta Theme');
    expect(response.body[1].name).toBe('Zeta Theme');
    expect(response.body[2].name).toBe('Alpha Boost');
  });
});