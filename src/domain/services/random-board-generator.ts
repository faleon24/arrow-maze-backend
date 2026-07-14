import { ArrowPathInfo } from '../models/arrow-path-info';
import { BoardLayout } from '../models/board-layout';
import { BoardSolver } from './board-solver';
import { IRandomSource } from './random-source';

const COLORS: readonly string[] = [
  'PINK',
  'GREEN',
  'BLUE',
  'YELLOW',
  'PURPLE',
];
const DIRECTIONS: readonly string[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
const DIFFICULTIES: readonly string[] = ['EASY', 'MEDIUM', 'HARD'];

interface DifficultyBoardParams {
  minRows: number;
  maxRows: number;
  minCols: number;
  maxCols: number;
  minArrows: number;
  maxArrows: number;
}

/**
 * RandomBoardGenerator — produces solver-verified random BoardLayouts.
 *
 * Algorithm (per attempt):
 *   1. Pick rows / cols within the difficulty's box.
 *   2. Pick an arrow count within the difficulty's range.
 *   3. For each arrow, retry random (cell, color, direction) tuples
 *      until one lands on a free cell.
 *   4. Assemble BoardLayout; its invariants (bounds, no overlap,
 *      unique ids) fail-fast on any inconsistency.
 *   5. Ask BoardSolver.isSolvable — reject and retry the whole board
 *      if not.
 *
 * The generator is single-cell only in this MVP. Bent arrows (L/U/S/
 * zigzag) would require a path-growth routine that respects the
 * Manhattan-1 contiguity + non-crossing invariants of ArrowPathInfo;
 * out of scope until playtest asks for it.
 *
 * The solver-verification loop is the quality gate: any board that
 * passes is winnable by SOME clearing order, so no deadlock levels
 * ever ship. Difficulty-scaled arrow counts + grid sizes keep the
 * generator terminating in a few dozen attempts even for HARD.
 *
 * Framework-agnostic: constructor takes a BoardSolver and an
 * IRandomSource. Composition root wires DefaultRandomSource in
 * production; specs inject SeededRandomSource for reproducibility.
 */
export class RandomBoardGenerator {
  private static readonly MAX_BOARD_ATTEMPTS = 40;
  private static readonly MAX_ARROW_ATTEMPTS = 30;
  private static readonly PARAMS: Record<string, DifficultyBoardParams> = {
    EASY: {
      minRows: 3,
      maxRows: 4,
      minCols: 3,
      maxCols: 4,
      minArrows: 2,
      maxArrows: 3,
    },
    MEDIUM: {
      minRows: 4,
      maxRows: 5,
      minCols: 4,
      maxCols: 5,
      minArrows: 3,
      maxArrows: 5,
    },
    HARD: {
      minRows: 5,
      maxRows: 7,
      minCols: 5,
      maxCols: 7,
      minArrows: 5,
      maxArrows: 8,
    },
  };

  constructor(
    private readonly solver: BoardSolver,
    private readonly rng: IRandomSource,
  ) {}

  generate(difficulty: string): BoardLayout {
    const normalized = difficulty.toUpperCase();
    if (!DIFFICULTIES.includes(normalized)) {
      throw new Error(
        `RandomBoardGenerator: unknown difficulty "${difficulty}", expected one of ${DIFFICULTIES.join(', ')}`,
      );
    }
    const params = RandomBoardGenerator.PARAMS[normalized];

    for (
      let attempt = 0;
      attempt < RandomBoardGenerator.MAX_BOARD_ATTEMPTS;
      attempt++
    ) {
      const layout = this.tryOnce(params);
      if (layout !== null && this.solver.isSolvable(layout)) {
        return layout;
      }
    }
    throw new Error(
      `RandomBoardGenerator: failed to produce a solvable ${difficulty} board after ${RandomBoardGenerator.MAX_BOARD_ATTEMPTS} attempts`,
    );
  }

  private tryOnce(params: DifficultyBoardParams): BoardLayout | null {
    const rows = this.randInclusive(params.minRows, params.maxRows);
    const cols = this.randInclusive(params.minCols, params.maxCols);
    const numArrows = this.randInclusive(params.minArrows, params.maxArrows);

    const occupied = new Set<string>();
    const arrows: ArrowPathInfo[] = [];

    for (let i = 0; i < numArrows; i++) {
      const arrow = this.tryPlaceArrow(i, rows, cols, occupied);
      if (arrow === null) return null;
      arrows.push(arrow);
      for (const cell of arrow.cells) occupied.add(cell);
    }

    try {
      return new BoardLayout({ rows, cols, arrows });
    } catch {
      return null;
    }
  }

  private tryPlaceArrow(
    index: number,
    rows: number,
    cols: number,
    occupied: Set<string>,
  ): ArrowPathInfo | null {
    for (
      let attempt = 0;
      attempt < RandomBoardGenerator.MAX_ARROW_ATTEMPTS;
      attempt++
    ) {
      const row = this.rng.nextInt(rows);
      const col = this.rng.nextInt(cols);
      const cell = `${row},${col}`;
      if (occupied.has(cell)) continue;

      const color = COLORS[this.rng.nextInt(COLORS.length)];
      const direction = DIRECTIONS[this.rng.nextInt(DIRECTIONS.length)];

      try {
        return new ArrowPathInfo(`a${index + 1}`, color, [cell], direction);
      } catch {
        continue;
      }
    }
    return null;
  }

  private randInclusive(min: number, max: number): number {
    return min + this.rng.nextInt(max - min + 1);
  }
}
