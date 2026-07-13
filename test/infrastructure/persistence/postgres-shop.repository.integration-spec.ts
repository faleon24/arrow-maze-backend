import { PrismaClient } from '@prisma/client';
import { PostgresShopRepository } from '../../../src/infrastructure/persistence/postgres-shop.repository';
import { PrismaService } from '../../../src/infrastructure/persistence/prisma.service';
import { DatabaseCleaner } from '../helpers/database-cleaner';

describe('PostgresShopRepository (integration)', () => {
  let prisma: PrismaService;
  let repository: PostgresShopRepository;
  let cleaner: DatabaseCleaner;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    repository = new PostgresShopRepository(prisma);
    cleaner = new DatabaseCleaner(prisma as unknown as PrismaClient);
  });

  beforeEach(async () => {
    await prisma.shopItem.createMany({
      data: [
        { id: 'item-a', name: 'Zeta Theme', costCoins: 10, kind: 'COSMETIC' },
        { id: 'item-b', name: 'Alpha Boost', costCoins: 50, kind: 'POWERUP' },
      ],
    });
  });

  afterEach(async () => {
    await cleaner.cleanAll();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should_return_null_when_item_does_not_exist', async () => {
    expect(await repository.findById('ghost')).toBeNull();
  });

  it('should_load_a_shop_item_by_id', async () => {
    const item = await repository.findById('item-a');

    expect(item).not.toBeNull();
    expect(item!.name).toBe('Zeta Theme');
    expect(item!.costCoins).toBe(10);
    expect(item!.kind).toBe('COSMETIC');
  });

  it('should_return_all_items_ordered_by_kind_then_name', async () => {
    const items = await repository.findAll();

    expect(items).toHaveLength(2);
    // COSMETIC before POWERUP (alphabetical kind), then alpha within.
    expect(items[0].kind).toBe('COSMETIC');
    expect(items[1].kind).toBe('POWERUP');
  });
});