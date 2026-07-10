/**
 * CellInfo value object.
 *
 * The flat, persistence-facing description of a single board cell, as
 * stored inside a Level's layout JSON and served to the mobile app.
 * The backend never runs the game, so it does NOT model cells as a
 * polymorphic hierarchy (that lives in the app, where a CellFactory
 * turns these snapshots into behavior). Here a cell is pure data:
 * a position, a type, and — only for arrow cells — a direction.
 *
 * SRP: this class only guarantees a cell snapshot is structurally
 * coherent (known type; arrows carry a direction, non-arrows do not).
 * It does not decide what a cell DOES.
 *
 * Immutability: fields are read-only; to change a cell you build a
 * new CellInfo.
 */
export class CellInfo {
  
  private static readonly KNOWN_TYPES = ['EMPTY', 'ARROW'];

  private static readonly KNOWN_DIRECTIONS = [
    'UP',
    'DOWN',
    'LEFT',
    'RIGHT',
  ];

  private readonly _position: string;
  private readonly _type: string;
  private readonly _direction: string | null;

  constructor(position: string, type: string, direction: string | null = null) {
    if (typeof position !== 'string' || position.trim().length === 0) {
      throw new Error('CellInfo position must be a non-empty string');
    }

    if (typeof type !== 'string') {
      throw new Error('CellInfo type must be a string');
    }
    const normalizedType = type.trim().toUpperCase();
    if (!CellInfo.KNOWN_TYPES.includes(normalizedType)) {
      throw new Error(`Unknown cell type: ${JSON.stringify(type)}`);
    }

    const normalizedDirection =
      direction === null || direction === undefined
        ? null
        : String(direction).trim().toUpperCase();

    if (normalizedType === 'ARROW') {
      if (
        normalizedDirection === null ||
        !CellInfo.KNOWN_DIRECTIONS.includes(normalizedDirection)
      ) {
        throw new Error(
          `Arrow cell requires a valid direction, got: ${JSON.stringify(
            direction,
          )}`,
        );
      }
    } else if (normalizedDirection !== null) {
      throw new Error(
        `Only arrow cells may carry a direction; ${normalizedType} cell got ${JSON.stringify(
          direction,
        )}`,
      );
    }

    this._position = position.trim();
    this._type = normalizedType;
    this._direction = normalizedDirection;
  }

  get position(): string {
    return this._position;
  }

  get type(): string {
    return this._type;
  }

  get direction(): string | null {
    return this._direction;
  }

  /**
   * Plain serializable snapshot, as stored in the board JSON and
   * returned by the API. Omits direction entirely for non-arrow cells.
   */
  toJSON(): { position: string; type: string; direction?: string } {
    return this._direction === null
      ? { position: this._position, type: this._type }
      : {
          position: this._position,
          type: this._type,
          direction: this._direction,
        };
  }
}