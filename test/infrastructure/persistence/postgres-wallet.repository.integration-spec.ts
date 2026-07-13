import { PrismaClient } from '@prisma/client';
import { Wallet } from '../../../src/domain/models/wallet';
import { PostgresWalletRepository } from '../../../src/infrastructure/persistence/postgres-wallet.repository';
import { PrismaService } from '../../../src/infrastructure/persistence/prisma.service';
import { DatabaseCleaner } from '../helpers/database-cleaner';

describe('PostgresWalletRepository (integration)', () => {
  let prisma: PrismaService;
  let repository: PostgresWalletRepository;
  let cleaner: DatabaseCleaner;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    repository = new PostgresWalletRepository(prisma);
    cleaner = new DatabaseCleaner(prisma as unknown as PrismaClient);
  });

  beforeEach(async () => {
    await prisma.user.create({
      data: {
        id: 'user-1',
        email: 'user-1@example.com',
        passwordHash: 'not-a-real-hash',
        displayName: 'Test',
      },
    });
  });

  afterEach(async () => {
    await cleaner.cleanAll();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should_return_null_when_user_has_no_wallet', async () => {
    expect(await repository.findByUser('user-1')).toBeNull();
  });

  it('should_persist_and_reload_a_wallet', async () => {
    await repository.save(new Wallet({ userId: 'user-1', balance: 250 }));

    const wallet = await repository.findByUser('user-1');

    expect(wallet).not.toBeNull();
    expect(wallet!.userId).toBe('user-1');
    expect(wallet!.balance).toBe(250);
  });

  it('should_upsert_when_saving_over_an_existing_wallet', async () => {
    await repository.save(new Wallet({ userId: 'user-1', balance: 100 }));
    await repository.save(new Wallet({ userId: 'user-1', balance: 300 }));

    const wallet = await repository.findByUser('user-1');
    expect(wallet!.balance).toBe(300);
  });
});