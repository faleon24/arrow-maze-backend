import { Wallet } from '../../../domain/models/wallet';

/**
 * IWalletRepository — per-user wallet persistence. save() is
 * idempotent by userId (upsert semantics in the adapter).
 */
export interface IWalletRepository {
  findByUser(userId: string): Promise<Wallet | null>;
  save(wallet: Wallet): Promise<void>;
}