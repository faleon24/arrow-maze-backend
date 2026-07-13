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
  let saveInventoryMock: jest.Mock;
  let saveWalletMock: jest.Mock;
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

    saveWalletMock = jest.fn().mockResolvedValue(undefined);
    walletRepo = {
      findByUser: jest.fn().mockResolvedValue(opts.wallet ?? null),
      save: saveWalletMock,
    } as unknown as IWalletRepository;

    saveInventoryMock = jest.fn().mockResolvedValue(undefined);
    inventoryRepo = {
      findByUser: jest.fn().mockResolvedValue(opts.inventory ?? null),
      save: saveInventoryMock,
    } as unknown as IInventoryRepository;

    useCase = new PurchaseItemUseCase(shopRepo, walletRepo, inventoryRepo);
  };

  it('should_debit_wallet_and_add_to_inventory_when_purchase_succeeds', async () => {
    setup({
      item: buildItem({ cost: 50 }),
      wallet: new Wallet({ userId: 'user-1', balance: 100 }),
      inventory: new Inventory({ userId: 'user-1' }),
    });

    await useCase.execute({ userId: 'user-1', itemId: 'item-1' });

    expect(saveInventoryMock).toHaveBeenCalledTimes(1);
    expect(saveWalletMock).toHaveBeenCalledTimes(1);

    const savedInventory: Inventory =
      saveInventoryMock.mock.calls[0][0];
    const savedWallet: Wallet = saveWalletMock.mock.calls[0][0];

    expect(savedInventory.owns('item-1')).toBe(true);
    expect(savedWallet.balance).toBe(50);
  });

  it('should_save_inventory_before_wallet', async () => {
    const callOrder: string[] = [];
    setup({
      item: buildItem(),
      wallet: new Wallet({ userId: 'user-1', balance: 100 }),
    });
    (inventoryRepo.save as jest.Mock).mockImplementation(async () => {
      callOrder.push('inventory');
    });
    (walletRepo.save as jest.Mock).mockImplementation(async () => {
      callOrder.push('wallet');
    });

    await useCase.execute({ userId: 'user-1', itemId: 'item-1' });

    expect(callOrder).toEqual(['inventory', 'wallet']);
  });

  it('should_throw_ItemNotFoundError_when_item_does_not_exist', async () => {
    setup({ item: null });

    await expect(
      useCase.execute({ userId: 'user-1', itemId: 'ghost' }),
    ).rejects.toThrow(ItemNotFoundError);

    expect(saveInventoryMock).not.toHaveBeenCalled();
    expect(saveWalletMock).not.toHaveBeenCalled();
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

    expect(saveInventoryMock).not.toHaveBeenCalled();
    expect(saveWalletMock).not.toHaveBeenCalled();
  });

  it('should_throw_InsufficientBalanceError_when_wallet_lacks_funds', async () => {
    setup({
      item: buildItem({ cost: 200 }),
      wallet: new Wallet({ userId: 'user-1', balance: 100 }),
    });

    await expect(
      useCase.execute({ userId: 'user-1', itemId: 'item-1' }),
    ).rejects.toThrow(InsufficientBalanceError);

    expect(saveInventoryMock).not.toHaveBeenCalled();
    expect(saveWalletMock).not.toHaveBeenCalled();
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
  });

  it('should_default_to_empty_inventory_when_user_has_no_prior_row', async () => {
    setup({
      item: buildItem({ cost: 50 }),
      wallet: new Wallet({ userId: 'user-1', balance: 100 }),
      inventory: null,
    });

    await useCase.execute({ userId: 'user-1', itemId: 'item-1' });

    const savedInventory: Inventory =
      saveInventoryMock.mock.calls[0][0];
    expect(savedInventory.owns('item-1')).toBe(true);
    expect(savedInventory.size).toBe(1);
  });
});