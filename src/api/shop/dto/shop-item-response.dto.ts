import { ShopItem } from '../../../domain/models/shop-item';

/**
 * ShopItemResponseDto — one catalog entry as it crosses the HTTP
 * boundary. Domain fields unwrapped into JSON primitives.
 */
export class ShopItemResponseDto {
  id!: string;
  name!: string;
  costCoins!: number;
  kind!: string;

  static fromDomain(item: ShopItem): ShopItemResponseDto {
    const dto = new ShopItemResponseDto();
    dto.id = item.id;
    dto.name = item.name;
    dto.costCoins = item.costCoins;
    dto.kind = item.kind;
    return dto;
  }
}