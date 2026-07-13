import { PrismaClient } from '@prisma/client';
import { Inventory } from '../../../src/domain/models/inventory';
import { PostgresInventoryRepository } from '../../../src/infrastructure/persistence/postgres-inventory.repository';
import { PrismaService } from '../../../src/infrastructure/persistence/prisma.service';
import { DatabaseCleaner } from '../helpers/database-cleaner';

describe('PostgresInventoryRepository (integration)', () => {
  let prisma: PrismaService;
  let repository: PostgresInventoryRepository;
  let cleaner: DatabaseCleaner;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    repository = new PostgresInventoryRepository(prisma);
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
    await prisma.shopItem.createMany({
      data: [
        { id: 'item-a', name: 'Theme A', costCoins: 10, kind: 'COSMETIC' },
        { id: 'item-b', name: 'Theme B', costCoins: 20, kind: 'COSMETIC' },
      ],
    });
  });

  afterEach(async () => {
    await cleaner.cleanAll();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should_return_null_when_user_has_no_inventory_entries', async () => {
    expect(await repository.findByUser('user-1')).toBeNull();
  });

  it('should_persist_owned_items_and_reload_them', async () => {
    await repository.save(
      new Inventory({ userId: 'user-1', itemIds: ['item-a', 'item-b'] }),
    );

    const inv = await repository.findByUser('user-1');

    expect(inv).not.toBeNull();
    expect(inv!.size).toBe(2);
    expect(inv!.owns('item-a')).toBe(true);
    expect(inv!.owns('item-b')).toBe(true);
  });

  it('should_be_idempotent_when_saving_the_same_inventory_twice', async () => {
    const inv = new Inventory({ userId: 'user-1', itemIds: ['item-a'] });
    await repository.save(inv);
    await repository.save(inv);

    const reloaded = await repository.findByUser('user-1');
    expect(reloaded!.size).toBe(1);
  });
});