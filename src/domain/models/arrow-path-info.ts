/**
 * ArrowPathInfo value object.
 *
 * The flat, persistence-facing description of one arrow-path on a v2
 * board. Replaces the v1 "1 arrow = 1 square" model with a polyline:
 * a contiguous ordered sequence of cells that snakes across the board.
 * The head is `cells.last` — the tip where the ray fires from in
 * `direction`. A one-cell path is the degenerate case that reproduces
 * v1 behavior, so old seeds can round-trip through the new model.
 *
 * The backend never runs the game, so ArrowPathInfo is pure data:
 * an id, a color, an ordered list of positions, and a direction. The
 * app materializes this snapshot into behavior (highlighting, ray
 * tracing, hit-testing).
 *
 * SRP: this class only guarantees a raw arrow-path is structurally
 * coherent. It does NOT decide whether the arrow is activatable,
 * blocked, or reachable — those are runtime properties of a live
 * board (BoardSolver / GameSession territory).
 *
 * Invariants (validated fail-fast at construction):
 *   1. id is a non-empty trimmed string.
 *   2. color ∈ KNOWN_COLORS (whitelist).
 *   3. direction ∈ KNOWN_DIRECTIONS (whitelist).
 *   4. cells has at least one entry.
 *   5. Every cell matches /^\d+,\d+$/ — a plain "row,col" of decimal
 *      integers, no signs, no whitespace. The strict regex closes
 *      the Number("") === 0 quirk that parseInt would let through.
 *   6. Consecutive cells differ by exactly (±1, 0) or (0, ±1) —
 *      orthogonal adjacency, no diagonals, no jumps.
 *   7. No cell repeats inside the path (the arrow never crosses
 *      itself).
 *
 * Immutability: fields are read-only; the internal cells array is
 * defensively copied and frozen at construction, so downstream code
 * cannot mutate it even if the caller kept a reference to the input.
 */
export class ArrowPathInfo {

  private static readonly KNOWN_COLORS = [
    'PINK',
    'GREEN',
    'BLUE',
    'YELLOW',
    'PURPLE',
  ];
  private static readonly KNOWN_DIRECTIONS = [
    'UP',
    'DOWN',
    'LEFT',
    'RIGHT',
  ];
  private static readonly CELL_PATTERN = /^\d+,\d+$/;
  private readonly _id: string;
  private readonly _color: string;
  private readonly _cells: readonly string[];
  private readonly _direction: string;
  constructor(
    id: string,
    color: string,
    cells: readonly string[],
    direction: string,
  ) {
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
    if (!ArrowPathInfo.KNOWN_DIRECTIONS.includes(normalizedDirection)) {
      throw new Error(
        `Unknown arrow direction: ${JSON.stringify(direction)}`,
      );
    }
    if (!Array.isArray(cells) || cells.length === 0) {
      throw new Error('ArrowPathInfo cells must be a non-empty array');
    }
    const seen = new Set<string>();
    const parsed: Array<{ row: number; col: number }> = [];
    for (const raw of cells) {
      if (typeof raw !== 'string' || !ArrowPathInfo.CELL_PATTERN.test(raw)) {
        throw new Error(
          `ArrowPathInfo cell must match "row,col" of ` +
            `non-negative integers, got: ${JSON.stringify(raw)}`,
        );
      }
      if (seen.has(raw)) {
        throw new Error(
          `ArrowPathInfo cells must not repeat, ` +
            `got duplicate: ${JSON.stringify(raw)}`,
        );
      }
      seen.add(raw);
      const [rowStr, colStr] = raw.split(',');
      parsed.push({
        row: parseInt(rowStr, 10),
        col: parseInt(colStr, 10),
      });
    }
    for (let i = 1; i < parsed.length; i++) {
      const prev = parsed[i - 1];
      const curr = parsed[i];
      const dr = Math.abs(curr.row - prev.row);
      const dc = Math.abs(curr.col - prev.col);
      // Orthogonal adjacency: exactly one of (dr, dc) is 1, other 0.
      if (dr + dc !== 1) {
        throw new Error(
          `ArrowPathInfo cells must be orthogonally contiguous; ` +
            `${JSON.stringify(cells[i - 1])} to ` +
            `${JSON.stringify(cells[i])} is not adjacent`,
        );
      }
    }
    this._id = id.trim();
    this._color = normalizedColor;
    this._cells = Object.freeze([...cells]);
    this._direction = normalizedDirection;
  }
  get id(): string {
    return this._id;
  }
  get color(): string {
    return this._color;
  }
  get cells(): readonly string[] {
    return this._cells;
  }
  get direction(): string {
    return this._direction;
  }
  /**
   * The head of the path — the tip where the ray fires from. By the
   * "cells are tail → head" convention this is the last element.
   */
  get head(): string {
    return this._cells[this._cells.length - 1];
  }
  /**
   * Plain serializable snapshot matching the v2 board JSON contract.
   */
  toJSON(): {
    id: string;
    color: string;
    cells: string[];
    direction: string;
  } {
    return {
      id: this._id,
      color: this._color,
      cells: [...this._cells],
      direction: this._direction,
    };
  }
}