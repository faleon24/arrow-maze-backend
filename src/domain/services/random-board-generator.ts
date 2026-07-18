import { ArrowPathInfo } from '../models/arrow-path-info';
import { BoardLayout } from '../models/board-layout';
import { CollectibleInfo } from '../models/collectible-info';
import { HEX_DIRECTIONS, hexStep, hexDirectionBetween } from '../models/hex';
import { BoardSolver } from './board-solver';
import { IRandomSource } from './random-source';

const COLORS: readonly string[] = [
  'PINK',
  'GREEN',
  'BLUE',
  'YELLOW',
  'PURPLE',
];
const DIRECTIONS: readonly string[] = HEX_DIRECTIONS;
const DIFFICULTIES: readonly string[] = ['EASY', 'MEDIUM', 'HARD'];

interface DifficultyParams {
  minRows: number;
  maxRows: number;
  minCols: number;
  maxCols: number;
  minArrows: number;
  maxArrows: number;
  minArrowLength: number;
  maxArrowLength: number;
  maxActivatableRatio: number;
  minCollectibles: number;
  maxCollectibles: number;
  turnBias: number;
}

/**
 * RandomBoardGenerator v5 (hex) — same density model as before
 * (multi-cell snakes) with reachable-only STAR placement, ported to a
 * hexagonal board using odd-r offset coordinates.
 *
 * Neighbours, growth and ray-tracing are now parity-aware: each step
 * is recomputed with hexStep(direction, row, col) instead of adding a
 * fixed {dr,dc} delta, because on a hex board the delta depends on the
 * parity of the current row.
 */
export class RandomBoardGenerator {
  private static readonly MAX_BOARD_ATTEMPTS = 200;
  private static readonly MAX_ARROW_ATTEMPTS = 50;
  private static readonly PARAMS: Record<string, DifficultyParams> = {
    EASY: {
      minRows: 4,
      maxRows: 5,
      minCols: 4,
      maxCols: 5,
      minArrows: 4,
      maxArrows: 6,
      minArrowLength: 2,
      maxArrowLength: 3,
      maxActivatableRatio: 1.0,
      minCollectibles: 0,
      maxCollectibles: 2,
      turnBias: 0.5,
    },
    MEDIUM: {
      minRows: 5,
      maxRows: 7,
      minCols: 5,
      maxCols: 7,
      minArrows: 6,
      maxArrows: 9,
      minArrowLength: 3,
      maxArrowLength: 5,
      maxActivatableRatio: 0.6,
      minCollectibles: 1,
      maxCollectibles: 3,
      turnBias: 0.6,
    },
    HARD: {
      minRows: 7,
      maxRows: 9,
      minCols: 7,
      maxCols: 9,
      minArrows: 10,
      maxArrows: 14,
      minArrowLength: 4,
      maxArrowLength: 7,
      maxActivatableRatio: 0.35,
      minCollectibles: 2,
      maxCollectibles: 4,
      turnBias: 0.7,
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
      if (layout === null) continue;
      if (!this.solver.isSolvable(layout)) continue;

      const activatable = this.countInitiallyActivatable(layout);
      const ratio = activatable / layout.arrows.length;
      if (ratio > params.maxActivatableRatio) continue;

      return layout;
    }
    throw new Error(
      `RandomBoardGenerator: failed to produce a satisfying ${difficulty} board after ${RandomBoardGenerator.MAX_BOARD_ATTEMPTS} attempts`,
    );
  }

  private tryOnce(params: DifficultyParams): BoardLayout | null {
    const rows = this.randInclusive(params.minRows, params.maxRows);
    const cols = this.randInclusive(params.minCols, params.maxCols);
    const numArrows = this.randInclusive(params.minArrows, params.maxArrows);

    const occupied = new Set<string>();
    const arrows: ArrowPathInfo[] = [];

    for (let i = 0; i < numArrows; i++) {
      const arrow = this.tryPlaceArrow(i, rows, cols, occupied, params);
      if (arrow === null) return null;
      arrows.push(arrow);
      for (const cell of arrow.cells) occupied.add(cell);
    }

    const collectibles = this.placeCollectibles(
      rows,
      cols,
      arrows,
      occupied,
      params,
    );

    try {
      return new BoardLayout({ rows, cols, arrows, collectibles });
    } catch {
      return null;
    }
  }

  /**
   * Place STARs only on cells reachable by some arrow's ray during a
   * valid greedy solve. Reachable set is intersected with free-cell
   * set (a STAR can't sit on an arrow segment or a wall). If the
   * reachable pool is smaller than the difficulty's target, we ship
   * fewer STARs — better than placing unreachable ones.
   */
  private placeCollectibles(
    rows: number,
    cols: number,
    arrows: ArrowPathInfo[],
    occupied: Set<string>,
    params: DifficultyParams,
  ): CollectibleInfo[] {
    const target = this.randInclusive(
      params.minCollectibles,
      params.maxCollectibles,
    );
    if (target === 0) return [];

    const reachable = this.computeReachableCells(
      rows,
      cols,
      arrows,
      new Set<string>(),
    );
    const pool = Array.from(reachable).filter((c) => !occupied.has(c));

    const collectibles: CollectibleInfo[] = [];
    while (collectibles.length < target && pool.length > 0) {
      const idx = this.rng.nextInt(pool.length);
      const cell = pool.splice(idx, 1)[0];
      occupied.add(cell);
      collectibles.push(new CollectibleInfo(cell, 'STAR'));
    }
    return collectibles;
  }

  /**
   * Simulate the greedy solve and return every cell that some arrow's
   * ray passes through as it fires. Excludes arrow segments (they sit
   * on the cell) but includes all clear cells the rays traverse.
   */
  private computeReachableCells(
    rows: number,
    cols: number,
    arrows: ArrowPathInfo[],
    walls: Set<string>,
  ): Set<string> {
    const arrowsById = new Map<string, ArrowPathInfo>(
      arrows.map((a) => [a.id, a]),
    );
    const remaining = new Set<string>(arrowsById.keys());
    const reachable = new Set<string>();

    let progressed = true;
    while (progressed && remaining.size > 0) {
      progressed = false;
      for (const id of remaining) {
        const arrow = arrowsById.get(id)!;
        const others = new Set<string>();
        for (const oid of remaining) {
          if (oid === id) continue;
          for (const c of arrowsById.get(oid)!.cells) others.add(c);
        }
        const rayCells = this.traceUnblockedRay(
          arrow,
          rows,
          cols,
          walls,
          others,
        );
        if (rayCells !== null) {
          for (const c of rayCells) reachable.add(c);
          remaining.delete(id);
          progressed = true;
          break;
        }
      }
    }
    return reachable;
  }

  private traceUnblockedRay(
    arrow: ArrowPathInfo,
    rows: number,
    cols: number,
    walls: Set<string>,
    otherCells: Set<string>,
  ): string[] | null {
    const cells: string[] = [];
    const [hr, hc] = arrow.head.split(',').map((s) => parseInt(s, 10));
    let { row: r, col: c } = hexStep(arrow.direction, hr, hc);
    while (r >= 0 && r < rows && c >= 0 && c < cols) {
      const cell = `${r},${c}`;
      if (walls.has(cell) || otherCells.has(cell)) return null;
      cells.push(cell);
      ({ row: r, col: c } = hexStep(arrow.direction, r, c));
    }
    return cells;
  }

  private tryPlaceArrow(
    index: number,
    rows: number,
    cols: number,
    occupied: Set<string>,
    params: DifficultyParams,
  ): ArrowPathInfo | null {
    const targetLen = this.randInclusive(
      params.minArrowLength,
      params.maxArrowLength,
    );

    for (
      let attempt = 0;
      attempt < RandomBoardGenerator.MAX_ARROW_ATTEMPTS;
      attempt++
    ) {
      const startRow = this.rng.nextInt(rows);
      const startCol = this.rng.nextInt(cols);
      const startCell = `${startRow},${startCol}`;
      if (occupied.has(startCell)) continue;

      const path = this.growPath(
        startCell,
        targetLen,
        rows,
        cols,
        occupied,
        params.turnBias,
      );
      if (path.length < 1) continue;

      const color = COLORS[this.rng.nextInt(COLORS.length)];
      const direction = this.pickHeadDirection(path);

      try {
        return new ArrowPathInfo(`a${index + 1}`, color, [...path], direction);
      } catch {
        continue;
      }
    }
    return null;
  }

  private growPath(
    startCell: string,
    targetLen: number,
    rows: number,
    cols: number,
    occupied: Set<string>,
    turnBias: number,
  ): string[] {
    const path = [startCell];
    const pathSet = new Set(path);
    let lastDir: string | null = null;

    while (path.length < targetLen) {
      const [r, c] = path[path.length - 1]
        .split(',')
        .map((s) => parseInt(s, 10));
      const candidates: { cell: string; dir: string }[] = [];
      for (const d of DIRECTIONS) {
        const { row: nr, col: nc } = hexStep(d, r, c);
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        const cell = `${nr},${nc}`;
        if (occupied.has(cell) || pathSet.has(cell)) continue;
        candidates.push({ cell, dir: d });
      }
      if (candidates.length === 0) break;

      let pickPool = candidates;
      if (
        lastDir !== null &&
        candidates.length > 1 &&
        this.rng.nextInt(100) < Math.floor(turnBias * 100)
      ) {
        const nonForward = candidates.filter((c) => c.dir !== lastDir);
        if (nonForward.length > 0) {
          pickPool = nonForward;
        }
      }

      const chosen = pickPool[this.rng.nextInt(pickPool.length)];
      path.push(chosen.cell);
      pathSet.add(chosen.cell);
      lastDir = chosen.dir;
    }
    return path;
  }

  private pickHeadDirection(path: string[]): string {
    if (path.length === 1) {
      return DIRECTIONS[this.rng.nextInt(DIRECTIONS.length)];
    }
    const [r1, c1] = path[path.length - 2]
      .split(',')
      .map((s) => parseInt(s, 10));
    const [r2, c2] = path[path.length - 1]
      .split(',')
      .map((s) => parseInt(s, 10));
    const dir = hexDirectionBetween({ row: r1, col: c1 }, { row: r2, col: c2 });
    if (dir !== null) return dir;
    return DIRECTIONS[this.rng.nextInt(DIRECTIONS.length)];
  }

  private countInitiallyActivatable(layout: BoardLayout): number {
    let count = 0;
    for (const arrow of layout.arrows) {
      if (this.isRayClear(arrow, layout)) count++;
    }
    return count;
  }

  private isRayClear(arrow: ArrowPathInfo, layout: BoardLayout): boolean {
    const others = new Set<string>();
    for (const a of layout.arrows) {
      if (a.id === arrow.id) continue;
      for (const c of a.cells) others.add(c);
    }
    const walls = new Set<string>(layout.walls);
    const [hr, hc] = arrow.head.split(',').map((s) => parseInt(s, 10));
    let { row: r, col: c } = hexStep(arrow.direction, hr, hc);
    while (r >= 0 && r < layout.rows && c >= 0 && c < layout.cols) {
      const cell = `${r},${c}`;
      if (walls.has(cell) || others.has(cell)) return false;
      ({ row: r, col: c } = hexStep(arrow.direction, r, c));
    }
    return true;
  }

  private randInclusive(min: number, max: number): number {
    return min + this.rng.nextInt(max - min + 1);
  }
}
