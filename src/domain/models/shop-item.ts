/**
 * ShopItem value object — one catalog entry the player can buy.
 *
 * Kind is a whitelist (COSMETIC, POWERUP) rather than an enum
 * (project constraint). The two categories cover this game's economy:
 * cosmetic themes/palettes and gameplay-affecting powerups (extra
 * lives, hints). Adding a third kind is a one-line change here and
 * to the seed; nothing else breaks.
 *
 * Cost is in coins as a non-negative integer; zero is allowed for
 * seasonal freebies. Identity is the id (persistence FK), and equality
 * checks all fields so tests can detect an unexpected mutation via
 * two loads of the same id.
 *
 * Immutability: fields are read-only, no setters. A catalog change
 * (e.g. price adjustment) is modeled as replacing the row via admin
 * upsert, not mutating an in-memory ShopItem.
 */
export class ShopItem {
  private static readonly KNOWN_KINDS = ['COSMETIC', 'POWERUP'];

  private readonly _id: string;
  private readonly _name: string;
  private readonly _costCoins: number;
  private readonly _kind: string;

  constructor(params: {
    id: string;
    name: string;
    costCoins: number;
    kind: string;
  }) {
    const { id, name, costCoins, kind } = params;

    if (typeof id !== 'string' || !id.trim()) {
      throw new Error('ShopItem: id must be a non-blank string');
    }
    if (typeof name !== 'string' || !name.trim()) {
      throw new Error('ShopItem: name must be a non-blank string');
    }
    if (!Number.isInteger(costCoins) || costCoins < 0) {
      throw new Error(
        'ShopItem: costCoins must be a non-negative integer',
      );
    }
    const normalizedKind =
      typeof kind === 'string' ? kind.trim().toUpperCase() : '';
    if (!ShopItem.KNOWN_KINDS.includes(normalizedKind)) {
      throw new Error(
        `ShopItem: unknown kind ${JSON.stringify(kind)}, expected one of ${ShopItem.KNOWN_KINDS.join(', ')}`,
      );
    }

    this._id = id;
    this._name = name;
    this._costCoins = costCoins;
    this._kind = normalizedKind;
  }

  get id(): string {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get costCoins(): number {
    return this._costCoins;
  }

  get kind(): string {
    return this._kind;
  }

  equals(other: ShopItem): boolean {
    return (
      this._id === other._id &&
      this._name === other._name &&
      this._costCoins === other._costCoins &&
      this._kind === other._kind
    );
  }
}