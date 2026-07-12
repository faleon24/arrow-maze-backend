/**
 * CollectibleInfo value object.
 *
 * The flat, persistence-facing description of one collectible on a
 * v2 board — a bonus item the player picks up when clearing an arrow
 * whose ray passes over its cell. Kept minimal (position + kind) so
 * the kind whitelist can grow (bomb, coin, key…) without breaking
 * the JSON contract; STAR is the only kind for now.
 *
 * SRP: this class only guarantees a collectible snapshot is
 * structurally coherent (valid position, known kind). It does NOT
 * decide what picking one up does — scoring, rewards, and animations
 * are downstream concerns (SubmitScoreUseCase, GameSession).
 *
 * Invariants (validated fail-fast at construction):
 *   1. position matches /^\d+,\d+$/ — a "row,col" of non-negative
 *      integers, no signs, no whitespace. Same strict format used by
 *      ArrowPathInfo cells so the two coordinate systems stay unified.
 *   2. kind ∈ KNOWN_KINDS (whitelist).
 *
 * Immutability: fields are read-only.
 */
export class CollectibleInfo {

  private static readonly KNOWN_KINDS = ['STAR'];
  private static readonly POSITION_PATTERN = /^\d+,\d+$/;
  private readonly _position: string;
  private readonly _kind: string;
  constructor(position: string, kind: string) {
    if (
      typeof position !== 'string' ||
      !CollectibleInfo.POSITION_PATTERN.test(position)
    ) {
      throw new Error(
        `CollectibleInfo position must match "row,col" of ` +
          `non-negative integers, got: ${JSON.stringify(position)}`,
      );
    }
    if (typeof kind !== 'string') {
      throw new Error('CollectibleInfo kind must be a string');
    }
    const normalizedKind = kind.trim().toUpperCase();
    if (!CollectibleInfo.KNOWN_KINDS.includes(normalizedKind)) {
      throw new Error(
        `Unknown collectible kind: ${JSON.stringify(kind)}`,
      );
    }
    this._position = position;
    this._kind = normalizedKind;
  }
  get position(): string {
    return this._position;
  }
  get kind(): string {
    return this._kind;
  }
  /**
   * Plain serializable snapshot matching the v2 board JSON contract.
   */
  toJSON(): { position: string; kind: string } {
    return {
      position: this._position,
      kind: this._kind,
    };
  }
}