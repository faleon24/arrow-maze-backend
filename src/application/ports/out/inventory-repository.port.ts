import { Inventory } from '../../../domain/models/inventory';

/**
 * IInventoryRepository — per-user owned-items set. save() upserts
 * by userId; adding an already-persisted item is a no-op.
 */
export interface IInventoryRepository {
  findByUser(userId: string): Promise<Inventory | null>;
  save(inventory: Inventory): Promise<void>;
}