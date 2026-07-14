import {
  AlreadyOwnedError,
  Inventory,
} from '../../../domain/models/inventory';
import { Wallet } from '../../../domain/models/wallet';
import { IInventoryRepository } from '../../ports/out/inventory-repository.port';
import { IPurchaseStore } from '../../ports/out/purchase-store.port';
import { IShopRepository } from '../../ports/out/shop-repository.port';
import { IWalletRepository } from '../../ports/out/wallet-repository.port';

export interface PurchaseItemCommand {
  userId: string;
  itemId: string;
}

/**
 * Thrown when a purchase references an itemId not in the shop catalog.
 * Carries the itemId so the API layer can map to 404 Not Found with a
 * useful body.
 */
export class ItemNotFoundError extends Error {
  constructor(public readonly itemId: string) {
    super(`Shop item "${itemId}" not found`);
    this.name = 'ItemNotFoundError';
  }
}

/**
 * PurchaseItemUseCase — buy a shop item for a user.
 *
 * Reads the item catalog, the user's wallet, and the user's inventory,
 * then coordinates the debit + add operations. Failure modes, ordered
 * fail-fast:
 *   1. ItemNotFoundError        — unknown itemId
 *   2. AlreadyOwnedError        — user already has this item
 *   3. InsufficientBalanceError — not enough coins
 *
 * Missing wallet or inventory rows mean the user hasn't touched the
 * shop yet — the use case defaults to an empty wallet (balance 0) and
 * empty inventory rather than 404. The first successful purchase is
 * the moment those rows are first written.
 *
 * Atomic persistence: both writes go through IPurchaseStore.commit,
 * which wraps them in a single Prisma $transaction. A partial failure
 * (wallet debited without inventory add, or vice versa) is impossible.
 *
 * Framework-agnostic — no Nest imports. Composition happens at
 * AppModule via useFactory.
 */
export class PurchaseItemUseCase {
  constructor(
    private readonly shop: IShopRepository,
    private readonly wallets: IWalletRepository,
    private readonly inventories: IInventoryRepository,
    private readonly store: IPurchaseStore,
  ) {}
  async execute(command: PurchaseItemCommand): Promise<void> {
    const item = await this.shop.findById(command.itemId);
    if (!item) {
      throw new ItemNotFoundError(command.itemId);
    }
    const wallet =
      (await this.wallets.findByUser(command.userId)) ??
      new Wallet({ userId: command.userId, balance: 0 });
    const inventory =
      (await this.inventories.findByUser(command.userId)) ??
      new Inventory({ userId: command.userId });
    if (inventory.owns(item.id)) {
      throw new AlreadyOwnedError(command.userId, item.id);
    }
    wallet.debit(item.costCoins);
    inventory.add(item.id);
    await this.store.commit(wallet, inventory);
  }
}
