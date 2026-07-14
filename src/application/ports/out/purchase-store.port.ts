import { Inventory } from '../../../domain/models/inventory';
import { Wallet } from '../../../domain/models/wallet';

/**
 * IPurchaseStore — atomic persistence for a purchase's two effects
 * (wallet debit and inventory add). Both writes happen inside a
 * single database transaction so a partial failure leaves neither.
 *
 * Kept separate from IWalletRepository / IInventoryRepository so
 * the per-aggregate ports stay free of the cross-cutting transaction
 * concern. The use case still reads through the aggregate ports and
 * mutates the domain models in memory; only the final write goes
 * through this port.
 */
export interface IPurchaseStore {
  commit(wallet: Wallet, inventory: Inventory): Promise<void>;
}
