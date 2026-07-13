import { Injectable } from '@nestjs/common';
import { Wallet } from '../../domain/models/wallet';
import { IWalletRepository } from '../../application/ports/out/wallet-repository.port';
import { PrismaService } from './prisma.service';

/**
 * PostgresWalletRepository — Prisma adapter for IWalletRepository.
 *
 * Upsert by userId: save() is idempotent per row. Absent row means
 * "user has not touched the shop yet" — caller (PurchaseItemUseCase)
 * defaults to an empty Wallet at balance 0.
 */
@Injectable()
export class PostgresWalletRepository implements IWalletRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUser(userId: string): Promise<Wallet | null> {
    const row = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!row) return null;
    return new Wallet({ userId: row.userId, balance: row.balance });
  }

  async save(wallet: Wallet): Promise<void> {
    await this.prisma.wallet.upsert({
      where: { userId: wallet.userId },
      create: { userId: wallet.userId, balance: wallet.balance },
      update: { balance: wallet.balance },
    });
  }
}