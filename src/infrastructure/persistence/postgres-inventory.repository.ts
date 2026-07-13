import { Injectable } from '@nestjs/common';
import { Inventory } from '../../domain/models/inventory';
import { IInventoryRepository } from '../../application/ports/out/inventory-repository.port';
import { PrismaService } from './prisma.service';

/**
 * PostgresInventoryRepository — Prisma adapter for IInventoryRepository.
 *
 * Add-only semantics: save() uses createMany({skipDuplicates:true}) so
 * a re-save with the same items is a no-op. Inventory has no remove
 * operation in this project — items are monotonic once purchased.
 * Absent rows for a user return null (not empty inventory) so the
 * caller can distinguish "never touched shop" from "explicitly empty".
 */
@Injectable()
export class PostgresInventoryRepository implements IInventoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUser(userId: string): Promise<Inventory | null> {
    const rows = await this.prisma.inventoryEntry.findMany({
      where: { userId },
      select: { itemId: true },
    });
    if (rows.length === 0) return null;
    return new Inventory({
      userId,
      itemIds: rows.map((r) => r.itemId),
    });
  }

  async save(inventory: Inventory): Promise<void> {
    if (inventory.itemIds.length === 0) return;
    await this.prisma.inventoryEntry.createMany({
      data: inventory.itemIds.map((itemId) => ({
        userId: inventory.userId,
        itemId,
      })),
      skipDuplicates: true,
    });
  }
}