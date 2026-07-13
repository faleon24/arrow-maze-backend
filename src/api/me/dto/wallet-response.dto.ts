import { Wallet } from '../../../domain/models/wallet';

export class WalletResponseDto {
  balance!: number;

  static fromDomain(wallet: Wallet): WalletResponseDto {
    const dto = new WalletResponseDto();
    dto.balance = wallet.balance;
    return dto;
  }
}