import { areHexAdjacent, isHexDirection } from './hex';

export class ArrowPathInfo {
  private static readonly KNOWN_COLORS = ['PINK', 'GREEN', 'BLUE', 'YELLOW', 'PURPLE'];
  private static readonly CELL_PATTERN = /^\d+,\d+$/;

  private readonly _id: string;
  private readonly _color: string;
  private readonly _cells: readonly string[];
  private readonly _direction: string;

  constructor(id: string, color: string, cells: readonly string[], direction: string) {
    if (typeof id !== 'string' || id.trim().length === 0) {
      throw new Error('ArrowPathInfo id must be a non-empty string');
    }

    if (typeof color !== 'string') {
      throw new Error('ArrowPathInfo color must be a string');
    }
    const normalizedColor = color.trim().toUpperCase();
    if (!ArrowPathInfo.KNOWN_COLORS.includes(normalizedColor)) {
      throw new Error(`Unknown arrow color: ${JSON.stringify(color)}`);
    }

    if (typeof direction !== 'string') {
      throw new Error('ArrowPathInfo direction must be a string');
    }
    const normalizedDirection = direction.trim().toUpperCase();
    if (!isHexDirection(normalizedDirection)) {
      throw new Error(`Unknown arrow direction: ${JSON.stringify(direction)}`);
    }

    if (!Array.isArray(cells) || cells.length === 0) {
      throw new Error('ArrowPathInfo cells must be a non-empty array');
    }

    const seen = new Set<string>();
    const parsed: Array<{ row: number; col: number }> = [];
    for (const raw of cells) {
      if (typeof raw !== 'string' || !ArrowPathInfo.CELL_PATTERN.test(raw)) {
        throw new Error(`ArrowPathInfo cell must match "row,col" of non-negative integers: ${JSON.stringify(raw)}`);
      }
      if (seen.has(raw)) {
        throw new Error(`ArrowPathInfo cells must not repeat, got duplicate: ${JSON.stringify(raw)}`);
      }
      seen.add(raw);
      const [rowStr, colStr] = raw.split(',');
      parsed.push({ row: parseInt(rowStr, 10), col: parseInt(colStr, 10) });
    }

    for (let i = 1; i < parsed.length; i++) {
      const prev = parsed[i - 1];
      const curr = parsed[i];
      if (!areHexAdjacent(prev, curr)) {
        throw new Error(
          `ArrowPathInfo cells must be hex-adjacent (odd-r offset); got ${JSON.stringify(cells[i - 1])} -> ${JSON.stringify(cells[i])}`,
        );
      }
    }

    this._id = id.trim();
    this._color = normalizedColor;
    this._cells = Object.freeze([...cells]);
    this._direction = normalizedDirection;
  }

  get id() {
    return this._id;
  }

  get color() {
    return this._color;
  }

  get cells() {
    return this._cells;
  }

  get direction() {
    return this._direction;
  }

  get head(): string {
    return this._cells[this._cells.length - 1];
  }

  toJSON() {
    return { id: this._id, color: this._color, cells: [...this._cells], direction: this._direction };
  }
}
