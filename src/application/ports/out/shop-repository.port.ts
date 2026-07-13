import { ShopItem } from '../../../domain/models/shop-item';

/**
 * IShopRepository — read-only catalog of purchasable items.
 * Seeded via migration; admin management is out of scope here.
 */
export interface IShopRepository {
  findById(id: string): Promise<ShopItem | null>;
  findAll(): Promise<ShopItem[]>;
}