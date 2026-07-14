import {
  AlreadyOwnedError,
  Inventory,
} from '../../../../src/domain/models/inventory';
import { ShopItem } from '../../../../src/domain/models/shop-item';
import {
  InsufficientBalanceError,
  Wallet,
} from '../../../../src/domain/models/wallet';
import { IInventoryRepository } from '../../../../src/application/ports/out/inventory-repository.port';
import { IPurchaseStore } from '../../../../src/application/ports/out/purchase-store.port';
import { IShopRepository } from '../../../../src/application/ports/out/shop-repository.port';
import { IWalletRepository } from '../../../../src/application/ports/out/wallet-repository.port';
import {
  ItemNotFoundError,
  PurchaseItemUseCase,
} from '../../../../src/application/usecases/purchase/purchase-item.usecase';

const buildItem = (
  overrides: Partial<{ id: string; cost: number }> = {},
) =>
  new ShopItem({
    id: overrides.id ?? 'item-1',
    name: 'Neon Theme',
    costCoins: overrides.cost ?? 50,
    kind: 'COSMETIC',
  });

describe('PurchaseItemUseCase', () => {
  let shopRepo: IShopRepository;
  let walletRepo: IWalletRepository;
  let inventoryRepo: IInventoryRepository;
  let store: IPurchaseStore;
  let commitMock: jest.Mock;
  let useCase: PurchaseItemUseCase;

  const setup = (opts: {
    item?: ShopItem | null;
    wallet?: Wallet | null;
    inventory?: Inventory | null;
  }) => {
    shopRepo = {
      findById: jest.fn().mockResolvedValue(opts.item ?? null),
      findAll: jest.fn(),
    } as unknown as IShopRepository;

    walletRepo = {
      findByUser: jest.fn().mockResolvedValue(opts.wallet ?? null),
      save: jest.fn().mockResolvedValue(undefined),
    } as unknown as IWalletRepository;

    inventoryRepo = {
      findByUser: jest.fn().mockResolvedValue(opts.inventory ?? null),
      save: jest.fn().mockResolvedValue(undefined),
    } as unknown as IInventoryRepository;

    commitMock = jest.fn().mockResolvedValue(undefined);
    store = { commit: commitMock } as IPurchaseStore;

    useCase = new PurchaseItemUseCase(
      shopRepo,
      walletRepo,
      inventoryRepo,
      store,
    );
  };

  it('should_commit_wallet_and_inventory_atomically_when_purchase_succeeds', async () => {
    setup({
      item: buildItem({ cost: 50 }),
      wallet: new Wallet({ userId: 'user-1', balance: 100 }),
      inventory: new Inventory({ userId: 'user-1' }),
    });

    await useCase.execute({ userId: 'user-1', itemId: 'item-1' });

    expect(commitMock).toHaveBeenCalledTimes(1);
    const [walletArg, inventoryArg]: [Wallet, Inventory] =
      commitMock.mock.calls[0];
    expect(walletArg.balance).toBe(50);
    expect(inventoryArg.owns('item-1')).toBe(true);
  });

  it('should_not_touch_the_aggregate_save_methods_when_committing_atomically', async () => {
    setup({
      item: buildItem({ cost: 10 }),
      wallet: new Wallet({ userId: 'user-1', balance: 100 }),
    });

    await useCase.execute({ userId: 'user-1', itemId: 'item-1' });

    // Aggregate ports are read-only during a purchase now; all writes
    // go through IPurchaseStore.commit.
    expect(walletRepo.save).not.toHaveBeenCalled();
    expect(inventoryRepo.save).not.toHaveBeenCalled();
  });

  it('should_throw_ItemNotFoundError_when_item_does_not_exist', async () => {
    setup({ item: null });

    await expect(
      useCase.execute({ userId: 'user-1', itemId: 'ghost' }),
    ).rejects.toThrow(ItemNotFoundError);
    expect(commitMock).not.toHaveBeenCalled();
  });

  it('should_throw_AlreadyOwnedError_when_user_already_owns_the_item', async () => {
    setup({
      item: buildItem(),
      wallet: new Wallet({ userId: 'user-1', balance: 100 }),
      inventory: new Inventory({ userId: 'user-1', itemIds: ['item-1'] }),
    });

    await expect(
      useCase.execute({ userId: 'user-1', itemId: 'item-1' }),
    ).rejects.toThrow(AlreadyOwnedError);
    expect(commitMock).not.toHaveBeenCalled();
  });

  it('should_throw_InsufficientBalanceError_when_wallet_lacks_funds', async () => {
    setup({
      item: buildItem({ cost: 200 }),
      wallet: new Wallet({ userId: 'user-1', balance: 100 }),
    });

    await expect(
      useCase.execute({ userId: 'user-1', itemId: 'item-1' }),
    ).rejects.toThrow(InsufficientBalanceError);
    expect(commitMock).not.toHaveBeenCalled();
  });

  it('should_default_to_empty_wallet_when_user_has_no_prior_row', async () => {
    setup({
      item: buildItem({ cost: 10 }),
      wallet: null,
    });
    // Empty wallet has balance 0 → InsufficientBalanceError fires
    // when we try to debit any positive cost.
    await expect(
      useCase.execute({ userId: 'user-1', itemId: 'item-1' }),
    ).rejects.toThrow(InsufficientBalanceError);
    expect(commitMock).not.toHaveBeenCalled();
  });

  it('should_default_to_empty_inventory_when_user_has_no_prior_row', async () => {
    setup({
      item: buildItem({ cost: 50 }),
      wallet: new Wallet({ userId: 'user-1', balance: 100 }),
      inventory: null,
    });

    await useCase.execute({ userId: 'user-1', itemId: 'item-1' });

    const [, inventoryArg]: [Wallet, Inventory] = commitMock.mock.calls[0];
    expect(inventoryArg.owns('item-1')).toBe(true);
    expect(inventoryArg.size).toBe(1);
  });
});
