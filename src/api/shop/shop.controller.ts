import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ListShopItemsUseCase } from '../../application/usecases/shop/list-shop-items.usecase';
import { ShopItemResponseDto } from './dto/shop-item-response.dto';

/**
 * ShopController — HTTP entry point for browsing the shop.
 *
 * Public route: catalog data is inherently shareable (no per-user
 * info). Auth would only annoy players wanting to inspect prices
 * before signing in.
 */
@ApiTags('shop')
@Controller('shop')
export class ShopController {
  constructor(private readonly listItems: ListShopItemsUseCase) {}

  @Get()
  @ApiOperation({ summary: 'List the shop catalog' })
  @ApiResponse({ status: 200, type: [ShopItemResponseDto] })
  async list(): Promise<ShopItemResponseDto[]> {
    const items = await this.listItems.execute();
    return items.map((item) => ShopItemResponseDto.fromDomain(item));
  }
}