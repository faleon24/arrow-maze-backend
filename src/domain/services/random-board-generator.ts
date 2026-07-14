import { ArrowPathInfo } from '../models/arrow-path-info';
import { BoardLayout } from '../models/board-layout';
import { CollectibleInfo } from '../models/collectible-info';
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

const DIRECTION_DELTAS: Record<string, { dr: number; dc: number }> = {
  UP: { dr: -1, dc: 0 },
  DOWN: { dr: 1, dc: 0 },
  LEFT: { dr: 0, dc: -1 },
  RIGHT: { dr: 0, dc: 1 },
};

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
  /**
   * Chance (0..1) that growPath rejects continuing in the same
   * direction and picks a turn instead. Higher = more L/U/S/snake
   * shapes, matching the reference game's visual density.
   */
  turnBias: number;
}

/**
 * RandomBoardGenerator v4 — denser, snakier boards that match the
 * reference SayGames Arrow Maze more closely.
 *
 * Changes vs v3:
 *   - Longer max arrow length (HARD up to 7 cells).
 *   - More arrows per board (HARD 10-14 vs 8-12).
 *   - Bigger HARD grids (7-9 vs 6-8).
 *   - Turn bias in growPath — biases the random walk toward changing
 *     direction, producing L/U/S/snake shapes rather than mostly
 *     straight paths.
 *   - MAX_BOARD_ATTEMPTS raised to 200 to accommodate the stricter
 *     packing constraints.
 */
export class RandomBoardGenerator {
  private static readonly MAX_BOARD_ATTEMPTS = 200;
  private static readonly MAX_ARROW_ATTEMPTS = 50;
  private static readonly MAX_COLLECTIBLE_ATTEMPTS = 30;
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
      occupied,
      params,
    );

    try {
      return new BoardLayout({ rows, cols, arrows, collectibles });
    } catch {
      return null;
    }
  }

  private placeCollectibles(
    rows: number,
    cols: number,
    occupied: Set<string>,
    params: DifficultyParams,
  ): CollectibleInfo[] {
    const target = this.randInclusive(
      params.minCollectibles,
      params.maxCollectibles,
    );
    if (target === 0) return [];

    const collectibles: CollectibleInfo[] = [];
    let attempts = 0;
    while (
      collectibles.length < target &&
      attempts < RandomBoardGenerator.MAX_COLLECTIBLE_ATTEMPTS
    ) {
      attempts++;
      const r = this.rng.nextInt(rows);
      const c = this.rng.nextInt(cols);
      const cell = `${r},${c}`;
      if (occupied.has(cell)) continue;
      occupied.add(cell);
      collectibles.push(new CollectibleInfo(cell, 'STAR'));
    }
    return collectibles;
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

  /**
   * Grow a Manhattan-1 non-crossing path via biased random walk.
   *
   * With probability `turnBias`, if we can turn (a non-forward
   * candidate exists), we drop the forward candidate from the choice
   * set — this produces the L/U/S/snake shapes that make dense boards
   * read visually. Falls back to uniform random when only the forward
   * candidate is available.
   */
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
    let lastDelta: { dr: number; dc: number } | null = null;

    while (path.length < targetLen) {
      const [r, c] = path[path.length - 1]
        .split(',')
        .map((s) => parseInt(s, 10));
      const candidates: {
        cell: string;
        delta: { dr: number; dc: number };
      }[] = [];
      for (const d of DIRECTIONS) {
        const delta = DIRECTION_DELTAS[d];
        const nr = r + delta.dr;
        const nc = c + delta.dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        const cell = `${nr},${nc}`;
        if (occupied.has(cell) || pathSet.has(cell)) continue;
        candidates.push({ cell, delta });
      }
      if (candidates.length === 0) break;

      // Turn bias: if we have a previous segment AND at least one
      // non-forward candidate, drop the forward candidate with the
      // configured probability.
      let pickPool = candidates;
      if (
        lastDelta !== null &&
        candidates.length > 1 &&
        this.rng.nextInt(100) < Math.floor(turnBias * 100)
      ) {
        const nonForward = candidates.filter(
          (c) => c.delta.dr !== lastDelta!.dr || c.delta.dc !== lastDelta!.dc,
        );
        if (nonForward.length > 0) {
          pickPool = nonForward;
        }
      }

      const chosen = pickPool[this.rng.nextInt(pickPool.length)];
      path.push(chosen.cell);
      pathSet.add(chosen.cell);
      lastDelta = chosen.delta;
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
    const dr = r2 - r1;
    const dc = c2 - c1;
    if (dr === -1) return 'UP';
    if (dr === 1) return 'DOWN';
    if (dc === -1) return 'LEFT';
    if (dc === 1) return 'RIGHT';
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
    const delta = DIRECTION_DELTAS[arrow.direction];
    let r = hr + delta.dr;
    let c = hc + delta.dc;
    while (r >= 0 && r < layout.rows && c >= 0 && c < layout.cols) {
      const cell = `${r},${c}`;
      if (walls.has(cell) || others.has(cell)) return false;
      r += delta.dr;
      c += delta.dc;
    }
    return true;
  }

  private randInclusive(min: number, max: number): number {
    return min + this.rng.nextInt(max - min + 1);
  }
}
