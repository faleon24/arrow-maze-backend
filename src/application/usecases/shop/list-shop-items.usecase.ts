import { ShopItem } from '../../../domain/models/shop-item';
import { IShopRepository } from '../../ports/out/shop-repository.port';

/**
 * ListShopItemsUseCase — return the full shop catalog.
 *
 * Thin coordinator: delegates to the port's findAll(), which the
 * adapter sorts by (kind asc, name asc). No filtering or pagination —
 * the catalog is small in this project; filters can be added later
 * without touching the controller.
 */
export class ListShopItemsUseCase {
  constructor(private readonly shop: IShopRepository) {}

  async execute(): Promise<ShopItem[]> {
    return this.shop.findAll();
  }
}