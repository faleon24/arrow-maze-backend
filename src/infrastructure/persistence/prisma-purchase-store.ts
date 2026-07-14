import { Injectable } from '@nestjs/common';

import { IPurchaseStore } from '../../application/ports/out/purchase-store.port';
import { Inventory } from '../../domain/models/inventory';
import { Wallet } from '../../domain/models/wallet';
import { PrismaService } from './prisma.service';

/**
 * PrismaPurchaseStore — Prisma adapter for IPurchaseStore.
 *
 * Wraps the wallet upsert and inventory createMany in a single
 * `prisma.$transaction((tx) => ...)` callback so both writes commit
 * together or roll back together. Same SQL each side would issue
 * outside a transaction, just brackets them.
 *
 * Idempotent: wallet upserts by userId (repeat runs collapse), and
 * inventory createMany uses skipDuplicates so replays never fail on
 * the unique (userId, itemId) constraint.
 */
@Injectable()
export class PrismaPurchaseStore implements IPurchaseStore {
  constructor(private readonly prisma: PrismaService) {}

  async commit(wallet: Wallet, inventory: Inventory): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.wallet.upsert({
        where: { userId: wallet.userId },
        create: { userId: wallet.userId, balance: wallet.balance },
        update: { balance: wallet.balance },
      });
      if (inventory.itemIds.length > 0) {
        await tx.inventoryEntry.createMany({
          data: inventory.itemIds.map((itemId) => ({
            userId: inventory.userId,
            itemId,
          })),
          skipDuplicates: true,
        });
      }
    });
  }
}
