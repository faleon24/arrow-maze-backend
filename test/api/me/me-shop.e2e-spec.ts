import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

import { AppModule } from '../../../src/app.module';
import { configureApp } from '../../../src/configure-app';
import { PrismaService } from '../../../src/infrastructure/persistence/prisma.service';
import { DatabaseCleaner } from '../../infrastructure/helpers/database-cleaner';

/**
 * E2E for /api/me/wallet and /api/me/purchases. Both endpoints require
 * a JWT; we register a fresh user in beforeEach to obtain one and pass
 * it in the Authorization header for every call.
 *
 * Assumes /api/auth/register returns a body with an accessToken field
 * and /api/auth/me returns the current user with an id — patterns
 * established in Fases 0.A.6 and earlier auth work.
 */
const ITEM_ID = '44444444-4444-4444-8444-444444444444';

describe('/api/me wallet + purchases (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cleaner: DatabaseCleaner;
  let bearer: string;
  let userId: string;

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

  beforeEach(async () => {
    await prisma.shopItem.create({
      data: {
        id: ITEM_ID,
        name: 'Neon Theme',
        costCoins: 50,
        kind: 'COSMETIC',
      },
    });

    const reg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'buyer@example.com',
        password: 'secret1234',
        displayName: 'Buyer',
      })
      .expect(201);
    bearer = reg.body.accessToken;

    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${bearer}`)
      .expect(200);
    userId = me.body.id;
  });

  afterEach(async () => {
    await cleaner.cleanAll();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should_return_zero_balance_when_user_has_no_wallet_row', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/me/wallet')
      .set('Authorization', `Bearer ${bearer}`)
      .expect(200);

    expect(res.body.balance).toBe(0);
  });

  it('should_reject_401_when_bearer_token_is_missing', async () => {
    await request(app.getHttpServer()).get('/api/me/wallet').expect(401);
  });

  it('should_purchase_item_when_wallet_has_enough_coins', async () => {
    await prisma.wallet.create({
      data: { userId, balance: 100 },
    });

    await request(app.getHttpServer())
      .post('/api/me/purchases')
      .set('Authorization', `Bearer ${bearer}`)
      .send({ itemId: ITEM_ID })
      .expect(204);

    const walletRes = await request(app.getHttpServer())
      .get('/api/me/wallet')
      .set('Authorization', `Bearer ${bearer}`)
      .expect(200);
    expect(walletRes.body.balance).toBe(50);
  });

  it('should_reject_409_when_item_already_owned', async () => {
    await prisma.wallet.create({ data: { userId, balance: 200 } });

    await request(app.getHttpServer())
      .post('/api/me/purchases')
      .set('Authorization', `Bearer ${bearer}`)
      .send({ itemId: ITEM_ID })
      .expect(204);

    await request(app.getHttpServer())
      .post('/api/me/purchases')
      .set('Authorization', `Bearer ${bearer}`)
      .send({ itemId: ITEM_ID })
      .expect(409);
  });

  it('should_reject_422_when_wallet_balance_is_insufficient', async () => {
    await request(app.getHttpServer())
      .post('/api/me/purchases')
      .set('Authorization', `Bearer ${bearer}`)
      .send({ itemId: ITEM_ID })
      .expect(422);
  });

  it('should_reject_404_when_item_does_not_exist', async () => {
    await request(app.getHttpServer())
      .post('/api/me/purchases')
      .set('Authorization', `Bearer ${bearer}`)
      .send({ itemId: '99999999-9999-4999-8999-999999999999' })
      .expect(404);
  });

  it('should_reject_400_when_itemId_is_not_a_valid_uuid', async () => {
    await request(app.getHttpServer())
      .post('/api/me/purchases')
      .set('Authorization', `Bearer ${bearer}`)
      .send({ itemId: 'not-a-uuid' })
      .expect(400);
  });
});