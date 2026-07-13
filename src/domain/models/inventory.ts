/**
 * Inventory aggregate — the set of shop items a user owns.
 *
 * One inventory per user (identity is userId, FK to User). Contents
 * are stored as item ids only — the full ShopItem catalog lives
 * elsewhere and is looked up when the client needs display info. This
 * keeps the aggregate small and the persistence table narrow (userId,
 * itemId join rows).
 *
 * add() enforces "no duplicates" so a caller can never accidentally
 * grant the same item twice. Duplicate arrivals at the constructor
 * (which would signal a bug in persistence) throw rather than silently
 * dedupe — we want the failure visible.
 */
export class Inventory {
  private readonly _userId: string;
  private readonly _itemIds: Set<string>;

  constructor(params: { userId: string; itemIds?: readonly string[] }) {
    const { userId, itemIds = [] } = params;

    if (typeof userId !== 'string' || !userId.trim()) {
      throw new Error('Inventory: userId must be a non-blank string');
    }

    const seen = new Set<string>();
    for (const id of itemIds) {
      if (typeof id !== 'string' || !id.trim()) {
        throw new Error(
          'Inventory: every item id must be a non-blank string',
        );
      }
      if (seen.has(id)) {
        throw new Error(
          `Inventory: duplicate item id "${id}" at construction`,
        );
      }
      seen.add(id);
    }

    this._userId = userId;
    this._itemIds = seen;
  }

  get userId(): string {
    return this._userId;
  }

  /** Snapshot copy — callers cannot mutate the internal Set. */
  get itemIds(): readonly string[] {
    return Array.from(this._itemIds);
  }

  get size(): number {
    return this._itemIds.size;
  }

  owns(itemId: string): boolean {
    return this._itemIds.has(itemId);
  }

  add(itemId: string): void {
    if (typeof itemId !== 'string' || !itemId.trim()) {
      throw new Error('Inventory.add: itemId must be a non-blank string');
    }
    if (this._itemIds.has(itemId)) {
      throw new AlreadyOwnedError(this._userId, itemId);
    }
    this._itemIds.add(itemId);
  }
}

/**
 * Thrown when Inventory.add is called with an item the user already
 * owns. Carries userId and itemId so the API layer can build a
 * meaningful message (a purchase gets 409 Conflict, not 500).
 */
export class AlreadyOwnedError extends Error {
  constructor(
    public readonly userId: string,
    public readonly itemId: string,
  ) {
    super(`User "${userId}" already owns item "${itemId}"`);
    this.name = 'AlreadyOwnedError';
  }
}