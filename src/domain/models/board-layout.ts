import { CellInfo } from './cell-info';

/**
 * BoardLayout value object.
 *
 * The flat description of a level's grid: its dimensions and the list
 * of cells that populate it. This is the persistence-and-transport
 * shape of a board — the app materializes it into a live, playable
 * Board (Composite) with a CellFactory; the backend only stores and
 * serves it.
 *
 * SRP: guarantees a layout is internally consistent (positive
 * dimensions, exactly one START and at least one EXIT, no cell placed
 * off the grid or on top of another). It does not simulate movement or
 * check solvability — that is the app's PathResolver, not the server's.
 */
export class BoardLayout {
  private readonly _rows: number;
  private readonly _cols: number;
  private readonly _cells: readonly CellInfo[];

  constructor(rows: number, cols: number, cells: CellInfo[]) {
    if (!Number.isInteger(rows) || rows <= 0) {
      throw new Error(`rows must be a positive integer, got ${rows}`);
    }
    if (!Number.isInteger(cols) || cols <= 0) {
      throw new Error(`cols must be a positive integer, got ${cols}`);
    }
    if (!Array.isArray(cells)) {
      throw new Error('cells must be an array');
    }

    const seenPositions = new Set<string>();
    let startCount = 0;
    let exitCount = 0;

    for (const cell of cells) {
      if (!(cell instanceof CellInfo)) {
        throw new Error('every cell must be a CellInfo instance');
      }

      if (seenPositions.has(cell.position)) {
        throw new Error(
          `duplicate cell at position ${JSON.stringify(cell.position)}`,
        );
      }
      seenPositions.add(cell.position);

      BoardLayout.assertWithinGrid(cell.position, rows, cols);

      if (cell.type === 'START') startCount += 1;
      if (cell.type === 'EXIT') exitCount += 1;
    }

    if (startCount !== 1) {
      throw new Error(
        `a board must have exactly one START cell, found ${startCount}`,
      );
    }
    if (exitCount < 1) {
      throw new Error('a board must have at least one EXIT cell');
    }

    this._rows = rows;
    this._cols = cols;
    this._cells = Object.freeze([...cells]);
  }

  get rows(): number {
    return this._rows;
  }

  get cols(): number {
    return this._cols;
  }

  get cells(): readonly CellInfo[] {
    return this._cells;
  }

  toJSON(): {
    rows: number;
    cols: number;
    cells: Array<{ position: string; type: string; direction?: string }>;
  } {
    return {
      rows: this._rows,
      cols: this._cols,
      cells: this._cells.map((c) => c.toJSON()),
    };
  }

  // ---------- Private helpers ----------

  /**
   * A position is the string "row,col". This checks it parses and
   * falls inside the declared grid bounds (0-indexed).
   */
  private static assertWithinGrid(
    position: string,
    rows: number,
    cols: number,
  ): void {
    const parts = position.split(',');
    if (parts.length !== 2) {
      throw new Error(
        `position must be "row,col", got ${JSON.stringify(position)}`,
      );
    }
    const row = Number(parts[0]);
    const col = Number(parts[1]);
    if (!Number.isInteger(row) || !Number.isInteger(col)) {
      throw new Error(
        `position must be two integers "row,col", got ${JSON.stringify(
          position,
        )}`,
      );
    }
    if (row < 0 || row >= rows || col < 0 || col >= cols) {
      throw new Error(
        `position ${JSON.stringify(position)} is outside a ${rows}x${cols} grid`,
      );
    }
  }
}