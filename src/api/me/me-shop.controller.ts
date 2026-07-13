import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { AlreadyOwnedError } from '../../domain/models/inventory';
import { InsufficientBalanceError } from '../../domain/models/wallet';
import { GetWalletUseCase } from '../../application/usecases/wallet/get-wallet.usecase';
import {
  ItemNotFoundError,
  PurchaseItemUseCase,
} from '../../application/usecases/purchase/purchase-item.usecase';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { WalletResponseDto } from './dto/wallet-response.dto';

/**
 * MeShopController — the player-facing wallet and purchase surface.
 *
 * Both endpoints require a valid JWT. userId always comes from the
 * token via @CurrentUserId, never from the body — a client can't buy
 * for someone else.
 *
 * Domain errors from PurchaseItemUseCase are translated to specific
 * HTTP statuses at this seam:
 *   - ItemNotFoundError        → 404 Not Found
 *   - AlreadyOwnedError        → 409 Conflict
 *   - InsufficientBalanceError → 422 Unprocessable Entity
 * Anything else propagates to DomainExceptionFilter (500).
 */
@ApiTags('me/shop')
@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeShopController {
  constructor(
    private readonly getWallet: GetWalletUseCase,
    private readonly purchaseItem: PurchaseItemUseCase,
  ) {}

  @Get('wallet')
  @ApiOperation({ summary: 'Current user coin balance' })
  @ApiResponse({ status: 200, type: WalletResponseDto })
  async wallet(
    @CurrentUserId() userId: string,
  ): Promise<WalletResponseDto> {
    const wallet = await this.getWallet.execute(userId);
    return WalletResponseDto.fromDomain(wallet);
  }

  @Post('purchases')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Buy a shop item with coins' })
  @ApiResponse({ status: 204, description: 'Purchase committed' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  @ApiResponse({ status: 409, description: 'Item already owned' })
  @ApiResponse({ status: 422, description: 'Insufficient balance' })
  async purchase(
    @CurrentUserId() userId: string,
    @Body() dto: CreatePurchaseDto,
  ): Promise<void> {
    try {
      await this.purchaseItem.execute({ userId, itemId: dto.itemId });
    } catch (e) {
      if (e instanceof ItemNotFoundError) {
        throw new NotFoundException(e.message);
      }
      if (e instanceof AlreadyOwnedError) {
        throw new ConflictException(e.message);
      }
      if (e instanceof InsufficientBalanceError) {
        throw new UnprocessableEntityException(e.message);
      }
      throw e;
    }
  }
}