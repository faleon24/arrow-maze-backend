import { Wallet } from '../../../domain/models/wallet';
import { IWalletRepository } from '../../ports/out/wallet-repository.port';

/**
 * GetWalletUseCase — return the user's wallet, or a default empty one
 * if no persistence row exists yet. Missing row means "user has not
 * touched the shop"; returning an empty wallet keeps the client's UI
 * consistent (always shows a "0 coins" balance) without a special 404.
 */
export class GetWalletUseCase {
  constructor(private readonly wallets: IWalletRepository) {}

  async execute(userId: string): Promise<Wallet> {
    const wallet = await this.wallets.findByUser(userId);
    return wallet ?? new Wallet({ userId, balance: 0 });
  }
}