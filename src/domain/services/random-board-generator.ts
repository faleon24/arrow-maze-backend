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
}

/**
 * RandomBoardGenerator — produces solver-verified, difficulty-scaled
 * random BoardLayouts (v3: with STAR collectibles).
 */
export class RandomBoardGenerator {
  private static readonly MAX_BOARD_ATTEMPTS = 100;
  private static readonly MAX_ARROW_ATTEMPTS = 40;
  private static readonly MAX_COLLECTIBLE_ATTEMPTS = 30;
  private static readonly PARAMS: Record<string, DifficultyParams> = {
    EASY: {
      minRows: 4,
      maxRows: 5,
      minCols: 4,
      maxCols: 5,
      minArrows: 3,
      maxArrows: 5,
      minArrowLength: 1,
      maxArrowLength: 2,
      maxActivatableRatio: 1.0,
      minCollectibles: 0,
      maxCollectibles: 2,
    },
    MEDIUM: {
      minRows: 5,
      maxRows: 6,
      minCols: 5,
      maxCols: 6,
      minArrows: 5,
      maxArrows: 8,
      minArrowLength: 1,
      maxArrowLength: 3,
      maxActivatableRatio: 0.7,
      minCollectibles: 1,
      maxCollectibles: 3,
    },
    HARD: {
      minRows: 6,
      maxRows: 8,
      minCols: 6,
      maxCols: 8,
      minArrows: 8,
      maxArrows: 12,
      minArrowLength: 1,
      maxArrowLength: 4,
      maxActivatableRatio: 0.4,
      minCollectibles: 2,
      maxCollectibles: 4,
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

  /**
   * Scatter STAR collectibles on random free cells. Difficulty-scaled
   * target count; may fall short if the board is too dense to place
   * more, which is fine — the game plays either way.
   */
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

      const path = this.growPath(startCell, targetLen, rows, cols, occupied);
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
  ): string[] {
    const path = [startCell];
    const pathSet = new Set(path);
    while (path.length < targetLen) {
      const [r, c] = path[path.length - 1]
        .split(',')
        .map((s) => parseInt(s, 10));
      const candidates: string[] = [];
      for (const d of DIRECTIONS) {
        const delta = DIRECTION_DELTAS[d];
        const nr = r + delta.dr;
        const nc = c + delta.dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        const cell = `${nr},${nc}`;
        if (occupied.has(cell) || pathSet.has(cell)) continue;
        candidates.push(cell);
      }
      if (candidates.length === 0) break;
      const next = candidates[this.rng.nextInt(candidates.length)];
      path.push(next);
      pathSet.add(next);
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
