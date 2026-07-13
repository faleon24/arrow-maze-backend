import { Injectable } from '@nestjs/common';
import { ShopItem } from '../../domain/models/shop-item';
import { IShopRepository } from '../../application/ports/out/shop-repository.port';
import { PrismaService } from './prisma.service';

/**
 * PostgresShopRepository — Prisma adapter for IShopRepository.
 *
 * Read-only. The catalog is populated by the seed (Fase 7.5) or by
 * a future admin endpoint (not shipped in this project). findAll()
 * sorts by (kind asc, name asc) so the UI can group POWERUPs and
 * COSMETICs and present alphabetically within each.
 */
@Injectable()
export class PostgresShopRepository implements IShopRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ShopItem | null> {
    const row = await this.prisma.shopItem.findUnique({ where: { id } });
    if (!row) return null;
    return new ShopItem({
      id: row.id,
      name: row.name,
      costCoins: row.costCoins,
      kind: row.kind,
    });
  }

  async findAll(): Promise<ShopItem[]> {
    const rows = await this.prisma.shopItem.findMany({
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
    });
    return rows.map(
      (r) =>
        new ShopItem({
          id: r.id,
          name: r.name,
          costCoins: r.costCoins,
          kind: r.kind,
        }),
    );
  }
}