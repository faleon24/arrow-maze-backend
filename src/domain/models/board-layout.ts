import { ArrowPathInfo } from './arrow-path-info';
import { CollectibleInfo } from './collectible-info';
/**
 * BoardLayout value object (v2).
 *
 * The flat description of a level's grid: dimensions plus the three
 * kinds of things that populate it — arrow-paths (the puzzle), walls
 * (obstacles that block rays), and collectibles (bonus items). This
 * is the persistence-and-transport shape of a board; the app
 * materializes it into a live, playable Board with a builder.
 *
 * Migrated from v1 ("1 arrow = 1 square" through CellInfo) to v2
 * (each arrow is a polyline of cells). The v1 CellInfo model is gone
 * from the domain; the JSON emitted by toJSON() advertises version:2
 * so a client that speaks v1 fails fast rather than silently
 * misreading the data.
 *
 * SRP: guarantees a layout is internally consistent — positive
 * dimensions, at least one arrow, every cell inside the grid, and
 * zero overlap between any pair of occupants. It does NOT check
 * solvability — that is BoardSolver's job (Fase 1.6), called
 * separately by admin upsert (Fase 6).
 *
 * Invariants (validated fail-fast at construction):
 *   1. rows, cols are positive integers.
 *   2. arrows.length >= 1 (a puzzle needs something to solve).
 *   3. Every arrow.id is unique across the board.
 *   4. Every referenced position (arrow segment, wall, collectible)
 *      is inside the [0, rows) x [0, cols) grid.
 *   5. Wall positions match /^\d+,\d+$/ and do not repeat.
 *   6. Zero overlap between ANY two occupants: an arrow segment
 *      cannot sit on another arrow segment, a wall, or a collectible;
 *      a wall cannot sit on a collectible; and so on. A single
 *      occupancy map catches every case in one pass.
 *   7. Collectible positions do not repeat.
 *
 * Immutability: internal arrays are defensively copied and frozen.
 */
export class BoardLayout {

  private static readonly BOARD_VERSION = 2;
  private static readonly WALL_PATTERN = /^\d+,\d+$/;
  private readonly _rows: number;
  private readonly _cols: number;
  private readonly _arrows: readonly ArrowPathInfo[];
  private readonly _walls: readonly string[];
  private readonly _collectibles: readonly CollectibleInfo[];
  constructor(params: {
    rows: number;
    cols: number;
    arrows: ArrowPathInfo[];
    walls?: readonly string[];
    collectibles?: CollectibleInfo[];
  }) {
    const {
      rows,
      cols,
      arrows,
      walls = [],
      collectibles = [],
    } = params;
    if (!Number.isInteger(rows) || rows <= 0) {
      throw new Error(`rows must be a positive integer, got ${rows}`);
    }
    if (!Number.isInteger(cols) || cols <= 0) {
      throw new Error(`cols must be a positive integer, got ${cols}`);
    }
    if (!Array.isArray(arrows) || arrows.length === 0) {
      throw new Error('a board must have at least one arrow');
    }
    if (!Array.isArray(walls)) {
      throw new Error('walls must be an array');
    }
    if (!Array.isArray(collectibles)) {
      throw new Error('collectibles must be an array');
    }
    // occupancy tracks every claimed cell along with a human-readable
    // label of what claims it, so any collision throws a message that
    // points at both offenders. Single pass instead of pairwise checks.
    const occupancy = new Map<string, string>();
    const arrowIds = new Set<string>();
    for (const arrow of arrows) {
      if (!(arrow instanceof ArrowPathInfo)) {
        throw new Error('every arrow must be an ArrowPathInfo instance');
      }
      if (arrowIds.has(arrow.id)) {
        throw new Error(`duplicate arrow id: ${JSON.stringify(arrow.id)}`);
      }
      arrowIds.add(arrow.id);
      for (const cell of arrow.cells) {
        BoardLayout.assertWithinGrid(cell, rows, cols);
        const prior = occupancy.get(cell);
        if (prior !== undefined) {
          throw new Error(
            `overlap at ${JSON.stringify(cell)}: ${prior} and ` +
              `arrow "${arrow.id}"`,
          );
        }
        occupancy.set(cell, `arrow "${arrow.id}"`);
      }
    }
    const wallSet = new Set<string>();
    for (const wall of walls) {
      if (typeof wall !== 'string' || !BoardLayout.WALL_PATTERN.test(wall)) {
        throw new Error(
          `wall position must match "row,col" of non-negative ` +
            `integers, got: ${JSON.stringify(wall)}`,
        );
      }
      if (wallSet.has(wall)) {
        throw new Error(`duplicate wall position: ${JSON.stringify(wall)}`);
      }
      wallSet.add(wall);
      BoardLayout.assertWithinGrid(wall, rows, cols);
      const prior = occupancy.get(wall);
      if (prior !== undefined) {
        throw new Error(
          `overlap at ${JSON.stringify(wall)}: ${prior} and wall`,
        );
      }
      occupancy.set(wall, 'wall');
    }
    const collectibleSet = new Set<string>();
    for (const collectible of collectibles) {
      if (!(collectible instanceof CollectibleInfo)) {
        throw new Error(
          'every collectible must be a CollectibleInfo instance',
        );
      }
      if (collectibleSet.has(collectible.position)) {
        throw new Error(
          `duplicate collectible position: ${JSON.stringify(collectible.position)}`,
        );
      }
      collectibleSet.add(collectible.position);
      BoardLayout.assertWithinGrid(collectible.position, rows, cols);
      const prior = occupancy.get(collectible.position);
      if (prior !== undefined) {
        throw new Error(
          `overlap at ${JSON.stringify(collectible.position)}: ` +
            `${prior} and collectible`,
        );
      }
      occupancy.set(collectible.position, 'collectible');
    }
    this._rows = rows;
    this._cols = cols;
    this._arrows = Object.freeze([...arrows]);
    this._walls = Object.freeze([...walls]);
    this._collectibles = Object.freeze([...collectibles]);
  }
  get rows(): number {
    return this._rows;
  }
  get cols(): number {
    return this._cols;
  }
  get arrows(): readonly ArrowPathInfo[] {
    return this._arrows;
  }
  get walls(): readonly string[] {
    return this._walls;
  }
  get collectibles(): readonly CollectibleInfo[] {
    return this._collectibles;
  }
  toJSON(): {
    version: number;
    rows: number;
    cols: number;
    arrows: Array<{ id: string; color: string; cells: string[]; direction: string }>;
    walls: string[];
    collectibles: Array<{ position: string; kind: string }>;
  } {
    return {
      version: BoardLayout.BOARD_VERSION,
      rows: this._rows,
      cols: this._cols,
      arrows: this._arrows.map((a) => a.toJSON()),
      walls: [...this._walls],
      collectibles: this._collectibles.map((c) => c.toJSON()),
    };
  }
  private static assertWithinGrid(
    position: string,
    rows: number,
    cols: number,
  ): void {
    const parts = position.split(',');
    const row = parseInt(parts[0], 10);
    const col = parseInt(parts[1], 10);
    if (row < 0 || row >= rows || col < 0 || col >= cols) {
      throw new Error(
        `position ${JSON.stringify(position)} is outside a ${rows}x${cols} grid`,
      );
    }
  }
}