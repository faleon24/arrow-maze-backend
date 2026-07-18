import 'dotenv/config';
import { PrismaService } from '../src/infrastructure/persistence/prisma.service';
import { PostgresLevelRepository } from '../src/infrastructure/persistence/postgres-level.repository';
import { Level } from '../src/domain/models/level';
import { BoardLayout } from '../src/domain/models/board-layout';
import { ArrowPathInfo } from '../src/domain/models/arrow-path-info';
import {
  EasyProfile,
  MediumProfile,
  HardProfile,
} from '../src/domain/models/difficulty-profile';
import { BoardSolver } from '../src/domain/services/board-solver';
import { RandomBoardGenerator } from '../src/domain/services/random-board-generator';
import { SeededRandomSource } from '../src/domain/services/random-source';
import { IIdGenerator } from '../src/application/ports/out/id-generator.port';
import { HEX_DIRECTIONS, hexStep } from '../src/domain/models/hex';

/**
 * SeededUuidGenerator — deterministic v4-format UUID sequence for the
 * generated (non-figure) levels. Same run number always produces the
 * same UUID, so repeated `npx prisma db seed` calls upsert the same
 * rows instead of accumulating duplicates.
 */
class SeededUuidGenerator implements IIdGenerator {
  private counter = 0;
  generate(): string {
    this.counter += 1;
    const hex = this.counter.toString(16).padStart(12, '0');
    return `abcdef00-0000-4000-8000-${hex}`;
  }
}

// ===========================================================================
// Hand-crafted FIGURE levels
// ===========================================================================
//
// Fifteen manually-designed levels whose arrows are laid out to draw a
// recognizable figure — a symbol or a letter — instead of a random
// scatter. Each '#' in a pattern becomes a single-cell arrow; '.' is
// empty space. EASY draws simple symbols, MEDIUM spells "ARROW", HARD
// spells "MAZE" plus a star. The shape is the point: the professor sees
// intent, not noise, and can read the game's name off the catalog.
//
// Directions are NOT hand-placed. They are derived by peeling the figure
// along one of the six hex axes (odd-r offset): cells are ordered from
// that edge inward, and each is given a direction whose ray to the border
// never crosses a cell removed later. Rays walk step by step via hexStep
// because odd-r has no fixed {dr,dc} delta -- the neighbour depends on
// the parity of the row. That makes the board solvable BY CONSTRUCTION (a valid clearing
// order exists — the peel order), while still choosing randomly among the
// valid directions per cell so the arrows look varied rather than all
// pointing the same way. BoardSolver.isSolvable double-checks every board
// before it ships.

type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
type PeelAxis = 'E' | 'W' | 'NE' | 'NW' | 'SE' | 'SW';

interface FigureSpec {
  name: string;
  difficulty: Difficulty;
  uuid: string;
  pattern: string[];
}

const COLORS = ['PINK', 'GREEN', 'BLUE', 'YELLOW', 'PURPLE'];

/** Small deterministic RNG (LCG) so figure direction choices are stable. */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Parse a '#'/'.' pattern into occupied "row,col" cell keys. */
function patternToCells(pattern: string[]): Array<{ r: number; c: number }> {
  const cells: Array<{ r: number; c: number }> = [];
  pattern.forEach((line, r) => {
    for (let c = 0; c < line.length; c++) {
      if (line[c] === '#') cells.push({ r, c });
    }
  });
  return cells;
}

/** Is the ray from (r,c) toward `dir` clear of every cell in `present`? */
function rayClear(
  r: number,
  c: number,
  dir: PeelAxis,
  rows: number,
  cols: number,
  present: Set<string>,
): boolean {
  let step = hexStep(dir, r, c);
  while (
    step.row >= 0 &&
    step.row < rows &&
    step.col >= 0 &&
    step.col < cols
  ) {
    if (present.has(`${step.row},${step.col}`)) return false;
    step = hexStep(dir, step.row, step.col);
  }
  return true;
}

/**
 * Assign every cell a direction so the figure is solvable. Peels from
 * `axis`: cells are removed in that order, and each cell picks a random
 * direction whose ray is clear of the not-yet-removed cells. The axis
 * direction itself is always valid for the current frontier cell, so a
 * choice always exists.
 */
function assignDirections(
  cells: Array<{ r: number; c: number }>,
  rows: number,
  cols: number,
  axis: PeelAxis,
  rng: () => number,
): Map<string, PeelAxis> {
  const order = [...cells].sort((a, b) => {
    switch (axis) {
      case 'NE':
      case 'NW':
        return a.r - b.r || a.c - b.c;
      case 'SE':
      case 'SW':
        return b.r - a.r || a.c - b.c;
      case 'W':
        return a.c - b.c || a.r - b.r;
      case 'E':
        return b.c - a.c || a.r - b.r;
    }
  });
  const present = new Set(cells.map((c) => `${c.r},${c.c}`));
  const dirs = new Map<string, PeelAxis>();
  for (const cell of order) {
    const key = `${cell.r},${cell.c}`;
    present.delete(key);
    const candidates = ([...HEX_DIRECTIONS] as PeelAxis[]).filter((d) =>
      rayClear(cell.r, cell.c, d, rows, cols, present),
    );
    // `axis` is guaranteed clear for the frontier cell, so candidates is
    // never empty; pick one at random for visual variety.
    const pick = candidates[Math.floor(rng() * candidates.length)];
    dirs.set(key, pick);
  }
  return dirs;
}

function profileFor(
  difficulty: Difficulty,
): EasyProfile | MediumProfile | HardProfile {
  switch (difficulty) {
    case 'EASY':
      return new EasyProfile();
    case 'MEDIUM':
      return new MediumProfile();
    case 'HARD':
      return new HardProfile();
  }
}

const solver = new BoardSolver();

/**
 * Build (and solver-verify) the board for a figure. `seedIndex` is the
 * figure's fixed position in the `figures` list — it drives the peel
 * axis and RNG, so a figure's arrow directions stay stable regardless
 * of where the level lands in the final (difficulty-grouped) catalog.
 */
function buildFigureBoard(spec: FigureSpec, seedIndex: number): BoardLayout {
  const rows = spec.pattern.length;
  const cols = Math.max(...spec.pattern.map((l) => l.length));
  const cells = patternToCells(spec.pattern);
  const rng = makeRng(0x9e37 + seedIndex * 2654435761);
  const axis = ([...HEX_DIRECTIONS] as PeelAxis[])[seedIndex % 6];
  const dirs = assignDirections(cells, rows, cols, axis, rng);

  const arrows = cells.map((cell, i) => {
    const key = `${cell.r},${cell.c}`;
    return new ArrowPathInfo(
      `a${i}`,
      COLORS[i % COLORS.length],
      [key],
      dirs.get(key)!,
    );
  });

  const board = new BoardLayout({ rows, cols, arrows });
  if (!solver.isSolvable(board)) {
    throw new Error(
      `Figure "${spec.name}" is not solvable — check its pattern/axis`,
    );
  }
  return board;
}

// The 15 figures. First three reuse the canonical UUIDs so any progress
// keyed to them (and the app's bundled dev fixture) stays aligned.
const figures: FigureSpec[] = [
  // ---------- EASY: symbols ----------
  {
    name: 'Plus',
    difficulty: 'EASY',
    uuid: '11111111-1111-4111-8111-111111111111',
    pattern: ['..#..', '..#..', '#####', '..#..', '..#..'],
  },
  {
    name: 'Square',
    difficulty: 'EASY',
    uuid: '22222222-2222-4222-8222-222222222222',
    pattern: ['#####', '#...#', '#...#', '#...#', '#####'],
  },
  {
    name: 'Diamond',
    difficulty: 'EASY',
    uuid: '33333333-3333-4333-8333-333333333333',
    pattern: ['..#..', '.#.#.', '#...#', '.#.#.', '..#..'],
  },
  {
    name: 'Triangle',
    difficulty: 'EASY',
    uuid: 'f16a0000-0000-4000-8000-000000000003',
    pattern: ['..#..', '..#..', '.#.#.', '.#.#.', '#####'],
  },
  {
    name: 'Letter T',
    difficulty: 'EASY',
    uuid: 'f16a0000-0000-4000-8000-000000000004',
    pattern: ['#####', '..#..', '..#..', '..#..', '..#..'],
  },
  // ---------- MEDIUM: spells "ARROW" ----------
  {
    name: 'Letter A',
    difficulty: 'MEDIUM',
    uuid: 'f16a0000-0000-4000-8000-000000000005',
    pattern: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  },
  {
    name: 'Letter R',
    difficulty: 'MEDIUM',
    uuid: 'f16a0000-0000-4000-8000-000000000006',
    pattern: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  },
  {
    name: 'Letter R (2)',
    difficulty: 'MEDIUM',
    uuid: 'f16a0000-0000-4000-8000-000000000007',
    pattern: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  },
  {
    name: 'Letter O',
    difficulty: 'MEDIUM',
    uuid: 'f16a0000-0000-4000-8000-000000000008',
    pattern: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  },
  {
    name: 'Letter W',
    difficulty: 'MEDIUM',
    uuid: 'f16a0000-0000-4000-8000-000000000009',
    pattern: [
      '#.....#',
      '#.....#',
      '#.....#',
      '#..#..#',
      '#.#.#.#',
      '##...##',
      '.#...#.',
    ],
  },
  // ---------- HARD: spells "MAZE" + a star ----------
  {
    name: 'Letter M',
    difficulty: 'HARD',
    uuid: 'f16a0000-0000-4000-8000-00000000000a',
    pattern: [
      '#.....#',
      '##...##',
      '#.#.#.#',
      '#..#..#',
      '#.....#',
      '#.....#',
      '#.....#',
    ],
  },
  {
    name: 'Letter A (hard)',
    difficulty: 'HARD',
    uuid: 'f16a0000-0000-4000-8000-00000000000b',
    pattern: [
      '..###..',
      '.#...#.',
      '#.....#',
      '#.....#',
      '#######',
      '#.....#',
      '#.....#',
    ],
  },
  {
    name: 'Letter Z',
    difficulty: 'HARD',
    uuid: 'f16a0000-0000-4000-8000-00000000000c',
    pattern: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  },
  {
    name: 'Letter E',
    difficulty: 'HARD',
    uuid: 'f16a0000-0000-4000-8000-00000000000d',
    pattern: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  },
  {
    name: 'Star',
    difficulty: 'HARD',
    uuid: 'f16a0000-0000-4000-8000-00000000000e',
    pattern: [
      '...#...',
      '.#.#.#.',
      '..###..',
      '#######',
      '..###..',
      '.#.#.#.',
      '...#...',
    ],
  },
];

// ===========================================================================
// Hand-crafted SHOWCASE levels
// ===========================================================================
//
// Five coiled, multi-cell puzzles that lead the catalog. Unlike the figure
// patterns above -- which are drawn on a square grid and therefore get
// sheared by odd-r's half-row shift -- these are laid out in cube
// coordinates and converted to offset, so a ring renders as a ring.
//
// Each arrow is a polyline whose `direction` is the label of its LAST
// segment, so the head continues where the body was already going.
// BoardSolver skips an arrow's own cells when ray-tracing, so a coil may
// bury its own head: the ray passes through its own body and stops only on
// a wall or on ANOTHER arrow still on the board. Difficulty is therefore
// pure ordering -- the branching factor per step is mostly 1, so of the n!
// tap orders only one or two actually clear the board.

// Coil showcase v6: dense folded arrows. Leviathan packs a 16x16 board to
// 100% (45 coils, 4 free starts). Heartbreaker is a FIGURE level: the arrows
// exactly tile a heart silhouette on a 14x17 board — the picture IS the
// puzzle and the player dismantles it. Split/merge annealing preserves the
// silhouette by construction (moves only repartition cells inside the mask).
interface ShowcaseSpec {
  name: string;
  uuid: string;
  difficulty: Difficulty;
  rows: number;
  cols: number;
  parTimeMs: number;
  arrows: Array<{ color: string; direction: string; cells: string[] }>;
}

const showcase: ShowcaseSpec[] = [
  {
    name: 'Hive',
    uuid: '5eed0000-0000-4000-8000-000000000006',
    difficulty: 'MEDIUM',
    rows: 9,
    cols: 9,
    parTimeMs: 234000,
    arrows: [
      { color: 'BLUE', direction: 'W', cells: ['6,8', '6,7', '7,6', '6,6', '6,5', '5,5', '5,6', '4,7', '3,7', '3,8', '4,8', '5,8', '5,7'] },
      { color: 'PINK', direction: 'NE', cells: ['6,3', '6,4', '5,4', '4,4', '5,3', '5,2', '4,2', '4,3', '3,3', '3,4', '2,5', '2,6', '1,6', '0,7'] },
      { color: 'YELLOW', direction: 'SW', cells: ['7,1', '6,1', '5,1', '4,1', '3,1', '2,1', '2,2', '3,2', '2,3', '2,4', '1,3', '0,3', '1,2'] },
      { color: 'GREEN', direction: 'NE', cells: ['0,2', '1,1', '1,0', '2,0', '3,0', '4,0', '5,0', '6,0', '7,0', '8,0', '8,1', '8,2', '7,2'] },
      { color: 'PURPLE', direction: 'NW', cells: ['7,8', '7,7', '8,8', '8,7', '8,6', '7,5', '7,4', '8,5', '8,4', '7,3'] },
      { color: 'GREEN', direction: 'E', cells: ['0,8', '1,8', '1,7', '2,8', '2,7', '3,6', '3,5', '4,5', '4,6'] },
      { color: 'BLUE', direction: 'NW', cells: ['0,6', '1,5', '1,4', '0,4'] },
      { color: 'PINK', direction: 'E', cells: ['0,0', '0,1'] },
    ],
  },
  {
    name: 'Circuit',
    uuid: '5eed0000-0000-4000-8000-000000000007',
    difficulty: 'MEDIUM',
    rows: 10,
    cols: 10,
    parTimeMs: 270000,
    arrows: [
      { color: 'GREEN', direction: 'E', cells: ['0,7', '1,7', '2,8', '3,7', '3,6', '3,5', '2,6', '2,7', '1,6', '1,5', '2,5', '3,4', '4,5', '4,6'] },
      { color: 'BLUE', direction: 'SE', cells: ['0,9', '1,9', '2,9', '3,8', '4,9', '5,8', '4,8', '4,7', '5,6', '5,7', '6,7', '6,6', '7,5', '8,6'] },
      { color: 'PURPLE', direction: 'W', cells: ['7,8', '6,8', '6,9', '7,9', '8,9', '9,8', '8,8', '7,7', '7,6', '8,7', '9,7', '9,6', '9,5', '9,4'] },
      { color: 'GREEN', direction: 'SE', cells: ['8,2', '9,1', '9,0', '8,0', '8,1', '7,1', '6,1', '5,1', '4,2', '3,1', '4,1', '5,0', '6,0', '7,0'] },
      { color: 'PINK', direction: 'SE', cells: ['0,2', '0,3', '1,2', '1,3', '2,3', '3,2', '2,2', '2,1', '3,0', '2,0', '1,0', '0,0', '0,1', '1,1'] },
      { color: 'PINK', direction: 'NE', cells: ['6,5', '5,5', '5,4', '6,4', '7,4', '8,5', '8,4', '8,3', '7,2', '7,3', '6,3', '5,2', '5,3', '4,4'] },
      { color: 'YELLOW', direction: 'SW', cells: ['0,4', '1,4', '2,4', '3,3'] },
      { color: 'YELLOW', direction: 'SE', cells: ['0,8', '1,8'] },
    ],
  },
  {
    name: 'Tangle',
    uuid: '5eed0000-0000-4000-8000-000000000008',
    difficulty: 'HARD',
    rows: 11,
    cols: 11,
    parTimeMs: 345000,
    arrows: [
      { color: 'YELLOW', direction: 'NW', cells: ['5,0', '4,1', '3,1', '3,2', '4,2', '5,1', '6,2', '6,1', '7,1', '7,2', '8,3', '8,4', '7,3'] },
      { color: 'GREEN', direction: 'W', cells: ['0,0', '0,1', '1,1', '2,2', '2,3', '3,3', '3,4', '4,4', '4,5', '3,5', '2,5', '1,5', '0,6', '0,5'] },
      { color: 'PURPLE', direction: 'SW', cells: ['6,7', '7,7', '6,8', '7,8', '8,9', '8,10', '7,10', '7,9', '6,9', '5,8', '5,9', '4,10', '5,10', '6,10'] },
      { color: 'PINK', direction: 'E', cells: ['4,7', '4,6', '5,5', '6,6', '7,6', '8,6', '8,7', '8,8', '9,7', '10,8', '9,8', '9,9'] },
      { color: 'GREEN', direction: 'NW', cells: ['5,6', '5,7', '4,8', '3,7', '2,7', '1,7', '1,8', '2,8', '3,8', '4,9', '3,9', '3,10', '2,10', '1,9'] },
      { color: 'BLUE', direction: 'SE', cells: ['9,5', '10,5', '10,4', '10,3', '9,3', '9,4', '8,5', '7,4', '7,5', '6,5', '5,4', '5,3', '6,4'] },
      { color: 'PINK', direction: 'NE', cells: ['8,1', '8,2', '9,2', '9,1', '10,2', '10,1', '10,0', '9,0', '8,0', '7,0'] },
      { color: 'BLUE', direction: 'SE', cells: ['3,6', '2,6', '1,6', '0,7', '0,8', '0,9', '0,10', '1,10'] },
      { color: 'BLUE', direction: 'NW', cells: ['2,4', '1,4', '0,4', '0,3', '1,3', '1,2', '0,2'] },
      { color: 'YELLOW', direction: 'NE', cells: ['10,9', '10,10', '9,10'] },
      { color: 'PURPLE', direction: 'SW', cells: ['10,7', '9,6', '10,6'] },
      { color: 'PINK', direction: 'E', cells: ['4,0', '3,0', '2,0', '2,1'] },
    ],
  },
  {
    name: 'Weave',
    uuid: '5eed0000-0000-4000-8000-000000000009',
    difficulty: 'HARD',
    rows: 12,
    cols: 12,
    parTimeMs: 384000,
    arrows: [
      { color: 'YELLOW', direction: 'NE', cells: ['6,0', '7,0', '8,0', '9,0', '8,1', '7,1', '7,2', '6,3', '5,2', '6,2', '6,1', '5,0', '5,1', '4,2'] },
      { color: 'PINK', direction: 'NW', cells: ['8,7', '9,7', '9,6', '10,6', '10,5', '9,5', '8,6', '7,5', '6,5', '6,4', '5,3', '4,3', '3,2'] },
      { color: 'GREEN', direction: 'E', cells: ['2,0', '3,0', '4,0', '4,1', '3,1', '2,1', '1,1', '0,2', '1,2', '2,3', '1,3', '0,4', '0,5', '0,6'] },
      { color: 'GREEN', direction: 'E', cells: ['11,0', '11,1', '11,2', '10,2', '9,2', '8,2', '8,3', '7,3', '7,4', '8,5', '9,4', '9,3', '10,3', '10,4'] },
      { color: 'PURPLE', direction: 'E', cells: ['7,7', '7,6', '6,6', '6,7', '5,7', '5,8', '4,8', '4,7', '5,6', '5,5', '5,4', '4,5', '3,4', '3,5'] },
      { color: 'BLUE', direction: 'E', cells: ['11,5', '11,6', '10,7', '10,8', '11,7', '11,8', '10,9', '9,9', '8,9', '9,8', '8,8', '7,8', '7,9'] },
      { color: 'PINK', direction: 'NW', cells: ['10,10', '11,10', '10,11', '9,11', '9,10', '8,10', '7,10', '6,11', '5,11', '4,11', '4,10', '5,10', '6,10', '5,9'] },
      { color: 'BLUE', direction: 'NE', cells: ['4,4', '3,3', '2,4', '2,5', '2,6', '1,6', '2,7', '2,8', '3,8', '3,9', '3,10', '2,11', '1,11'] },
      { color: 'YELLOW', direction: 'NW', cells: ['1,10', '0,11', '0,10', '1,9', '2,10', '2,9', '1,8', '0,9', '0,8', '1,7', '0,7'] },
      { color: 'PINK', direction: 'SW', cells: ['0,0', '0,1', '1,0'] },
      { color: 'PURPLE', direction: 'NE', cells: ['10,0', '10,1', '9,1'] },
      { color: 'GREEN', direction: 'SW', cells: ['7,11', '8,11'] },
    ],
  },
  {
    name: 'Gridlock',
    uuid: '5eed0000-0000-4000-8000-00000000000a',
    difficulty: 'HARD',
    rows: 13,
    cols: 13,
    parTimeMs: 447000,
    arrows: [
      { color: 'PURPLE', direction: 'SE', cells: ['3,0', '3,1', '3,2', '3,3', '2,4', '1,3', '0,3', '1,2', '2,3', '2,2', '1,1', '0,1', '1,0', '2,1'] },
      { color: 'YELLOW', direction: 'SE', cells: ['4,0', '5,0', '6,0', '7,0', '7,1', '7,2', '7,3', '6,4', '5,4', '5,5', '6,6', '6,5', '7,4', '8,5'] },
      { color: 'GREEN', direction: 'W', cells: ['11,7', '10,8', '9,8', '10,9', '11,8', '12,8', '12,7', '12,6', '11,6', '10,7', '9,7', '9,6', '9,5', '9,4'] },
      { color: 'PURPLE', direction: 'SW', cells: ['12,4', '12,3', '11,2', '10,2', '10,1', '9,0', '8,0', '8,1', '9,1', '9,2', '8,2', '8,3', '8,4', '9,3'] },
      { color: 'PINK', direction: 'W', cells: ['0,5', '1,4', '2,5', '3,5', '4,6', '5,6', '6,7', '6,8', '7,8', '8,8', '7,7', '7,6', '8,7', '8,6'] },
      { color: 'GREEN', direction: 'NW', cells: ['3,7', '4,7', '5,7', '4,8', '3,8', '4,9', '4,10', '5,9', '5,8', '6,9', '6,10', '5,10', '4,11', '3,10'] },
      { color: 'BLUE', direction: 'E', cells: ['3,9', '2,10', '1,9', '1,8', '2,8', '2,7', '3,6', '2,6', '1,6', '1,7', '0,8', '0,9', '0,10'] },
      { color: 'PINK', direction: 'SW', cells: ['3,12', '2,12', '1,12', '0,12', '0,11', '1,10', '1,11', '2,11', '3,11', '4,12', '5,12', '5,11', '6,11'] },
      { color: 'BLUE', direction: 'SW', cells: ['7,9', '8,9', '9,9', '8,10', '7,10', '8,11', '9,11', '10,12', '9,12', '8,12', '7,12', '6,12', '7,11'] },
      { color: 'YELLOW', direction: 'SE', cells: ['9,10', '10,10', '10,11', '11,10', '11,9', '12,9', '12,10', '12,11', '11,11', '12,12'] },
      { color: 'PINK', direction: 'SW', cells: ['12,5', '11,4', '11,3', '10,3', '10,4', '10,5', '10,6', '11,5'] },
      { color: 'BLUE', direction: 'NW', cells: ['12,0', '12,1', '12,2', '11,1', '11,0', '10,0'] },
      { color: 'GREEN', direction: 'SW', cells: ['0,6', '1,5'] },
    ],
  },
  {
    name: 'Leviathan',
    uuid: '5eed0000-0000-4000-8000-00000000000b',
    difficulty: 'HARD',
    rows: 16,
    cols: 16,
    parTimeMs: 765000,
    arrows: [
      { color: 'PURPLE', direction: 'SE', cells: ['2,0', '1,0', '0,1', '0,2', '1,2', '1,3', '0,3', '0,4', '1,4', '0,5', '0,6', '1,6'] },
      { color: 'YELLOW', direction: 'NE', cells: ['7,9', '6,9', '5,9', '5,10', '6,10', '7,10', '7,11', '6,11', '5,11', '4,12', '3,11', '3,10', '2,11'] },
      { color: 'PINK', direction: 'SW', cells: ['0,13', '0,14', '1,13', '1,12', '1,11', '2,12', '2,13', '2,14', '1,14', '0,15', '1,15', '2,15', '3,14'] },
      { color: 'PURPLE', direction: 'SW', cells: ['9,9', '8,10', '8,11', '8,12', '7,12', '6,13', '6,12', '5,12', '4,13', '3,12', '3,13', '4,14', '5,14', '6,14'] },
      { color: 'PINK', direction: 'SW', cells: ['11,13', '11,12', '10,13', '9,13', '10,14', '10,15', '9,15', '8,15', '8,14', '8,13', '9,12', '9,11', '10,11'] },
      { color: 'GREEN', direction: 'SE', cells: ['14,14', '14,15', '13,14', '13,15', '12,15', '11,14', '12,14', '13,13', '13,12', '12,12', '11,11', '11,10', '12,11'] },
      { color: 'GREEN', direction: 'SW', cells: ['15,2', '15,1', '14,2', '13,1', '12,2', '12,3', '11,2', '10,3', '9,3', '8,4', '7,3', '7,2', '8,3', '9,2'] },
      { color: 'YELLOW', direction: 'SW', cells: ['9,0', '8,1', '7,1', '6,1', '5,1', '6,2', '6,3', '6,4', '5,4', '4,5', '3,4', '2,4', '3,3', '4,4', '5,3', '5,2', '4,3', '3,2', '2,3', '2,2', '3,1'] },
      { color: 'BLUE', direction: 'E', cells: ['14,8', '15,8', '15,9', '14,10', '14,9', '13,9', '13,10', '14,11', '15,11', '15,12', '14,13', '15,13', '15,14'] },
      { color: 'PINK', direction: 'NE', cells: ['8,0', '7,0', '6,0', '5,0', '4,0', '4,1', '3,0', '2,1', '1,1'] },
      { color: 'PINK', direction: 'NE', cells: ['10,7', '9,6', '8,7', '8,8', '8,9', '7,8', '7,7', '7,6', '8,6', '8,5', '7,4', '6,5', '5,5', '4,6'] },
      { color: 'BLUE', direction: 'NW', cells: ['5,6', '4,7', '3,7', '2,7', '1,7', '1,8', '1,9', '2,10', '3,9', '4,10', '4,9', '3,8'] },
      { color: 'BLUE', direction: 'SE', cells: ['11,8', '10,9', '9,8', '9,7', '10,8', '11,7', '12,8', '12,7', '11,6', '10,6', '11,5', '12,6', '13,6'] },
      { color: 'YELLOW', direction: 'SW', cells: ['9,5', '9,4', '10,4', '11,3'] },
      { color: 'YELLOW', direction: 'SE', cells: ['9,10', '10,10', '11,9', '12,10'] },
      { color: 'BLUE', direction: 'NE', cells: ['15,5', '15,4', '15,3', '14,4'] },
      { color: 'YELLOW', direction: 'NE', cells: ['7,13', '7,14', '7,15', '6,15', '5,15', '4,15', '3,15'] },
      { color: 'GREEN', direction: 'NE', cells: ['0,7', '0,8', '0,9', '0,10', '1,10', '0,11'] },
      { color: 'GREEN', direction: 'SE', cells: ['0,0'] },
      { color: 'BLUE', direction: 'E', cells: ['0,12'] },
      { color: 'BLUE', direction: 'SW', cells: ['11,15'] },
      { color: 'GREEN', direction: 'SE', cells: ['12,0'] },
      { color: 'PURPLE', direction: 'NE', cells: ['15,10'] },
      { color: 'PINK', direction: 'SW', cells: ['15,15'] },
      { color: 'GREEN', direction: 'SW', cells: ['1,5', '2,6', '3,5'] },
      { color: 'PINK', direction: 'NW', cells: ['2,5'] },
      { color: 'YELLOW', direction: 'SE', cells: ['2,9'] },
      { color: 'PURPLE', direction: 'NW', cells: ['3,6'] },
      { color: 'GREEN', direction: 'W', cells: ['4,2'] },
      { color: 'PURPLE', direction: 'NE', cells: ['5,8', '6,8', '6,7', '5,7', '4,8'] },
      { color: 'PURPLE', direction: 'NW', cells: ['4,11'] },
      { color: 'BLUE', direction: 'E', cells: ['5,13'] },
      { color: 'GREEN', direction: 'NE', cells: ['7,5', '6,6'] },
      { color: 'BLUE', direction: 'SW', cells: ['8,2', '9,1', '10,1'] },
      { color: 'PURPLE', direction: 'NE', cells: ['9,14'] },
      { color: 'YELLOW', direction: 'SW', cells: ['10,2', '11,1'] },
      { color: 'PURPLE', direction: 'SW', cells: ['10,5', '11,4'] },
      { color: 'BLUE', direction: 'E', cells: ['10,12'] },
      { color: 'YELLOW', direction: 'E', cells: ['12,13'] },
      { color: 'PINK', direction: 'SE', cells: ['13,11', '14,12'] },
      { color: 'GREEN', direction: 'NE', cells: ['15,7', '14,7', '13,7', '13,8', '12,9'] },
      { color: 'PURPLE', direction: 'SW', cells: ['10,0', '11,0', '12,1', '13,0'] },
      { color: 'PINK', direction: 'SW', cells: ['14,0', '14,1', '15,0'] },
      { color: 'PINK', direction: 'W', cells: ['15,6', '14,6', '13,5', '14,5', '13,4', '12,5', '12,4'] },
      { color: 'YELLOW', direction: 'SE', cells: ['13,3', '13,2', '14,3'] },
    ],
  },
  {
    name: 'Heartbreaker',
    uuid: '5eed0000-0000-4000-8000-00000000000c',
    difficulty: 'HARD',
    rows: 14,
    cols: 17,
    parTimeMs: 456000,
    arrows: [
      { color: 'PINK', direction: 'NE', cells: ['0,2', '1,2', '1,1', '2,1', '3,1', '4,1', '3,0', '4,0', '5,0', '6,1', '6,2', '5,1', '4,2'] },
      { color: 'PURPLE', direction: 'NW', cells: ['6,4', '6,3', '7,2', '8,3', '7,3', '7,4', '8,5', '8,4', '9,4', '10,5', '10,6', '9,5'] },
      { color: 'PINK', direction: 'NE', cells: ['5,16', '4,16', '4,15', '4,14', '5,13', '5,12', '6,13', '6,12', '5,11', '4,12', '4,13', '3,13', '2,14'] },
      { color: 'YELLOW', direction: 'SE', cells: ['0,11', '0,12', '1,12', '2,12', '1,11', '1,10', '2,10', '2,11', '3,11', '3,10', '4,10', '5,9', '6,10'] },
      { color: 'GREEN', direction: 'SE', cells: ['5,10', '6,11', '7,11', '7,10', '8,10', '9,10'] },
      { color: 'GREEN', direction: 'NE', cells: ['1,6', '2,7', '3,6', '4,7', '3,7', '2,8', '2,9', '3,9', '3,8', '4,8', '5,7', '5,8', '4,9'] },
      { color: 'PINK', direction: 'NE', cells: ['10,9', '10,8', '9,7', '8,7', '7,7'] },
      { color: 'BLUE', direction: 'W', cells: ['2,16', '3,16', '3,15'] },
      { color: 'PURPLE', direction: 'SE', cells: ['2,5', '3,4', '4,4', '4,3', '3,2', '3,3', '2,4', '1,4', '1,5', '2,6', '3,5', '4,6'] },
      { color: 'BLUE', direction: 'SE', cells: ['5,3', '5,4', '4,5', '5,5', '6,5', '6,6', '6,7', '7,6', '7,5', '8,6', '9,6', '10,7', '11,7'] },
      { color: 'YELLOW', direction: 'SW', cells: ['11,6', '12,7', '12,8', '11,8', '11,9', '12,9'] },
      { color: 'BLUE', direction: 'E', cells: ['0,3', '0,4', '0,5'] },
      { color: 'YELLOW', direction: 'NE', cells: ['2,2', '2,3', '1,3'] },
      { color: 'GREEN', direction: 'SE', cells: ['2,0'] },
      { color: 'PURPLE', direction: 'SW', cells: ['2,13', '3,12'] },
      { color: 'BLUE', direction: 'SE', cells: ['4,11'] },
      { color: 'GREEN', direction: 'SE', cells: ['5,2'] },
      { color: 'YELLOW', direction: 'NE', cells: ['5,6'] },
      { color: 'GREEN', direction: 'NW', cells: ['6,14', '6,15', '5,14'] },
      { color: 'BLUE', direction: 'NW', cells: ['5,15'] },
      { color: 'PINK', direction: 'NW', cells: ['8,9', '7,9', '6,9'] },
      { color: 'PURPLE', direction: 'W', cells: ['7,12'] },
      { color: 'PINK', direction: 'NE', cells: ['8,11'] },
      { color: 'PURPLE', direction: 'NE', cells: ['9,12'] },
      { color: 'PINK', direction: 'SW', cells: ['13,8'] },
      { color: 'YELLOW', direction: 'SE', cells: ['6,8', '7,8'] },
      { color: 'BLUE', direction: 'SW', cells: ['7,14', '7,13', '8,13', '8,12', '9,11'] },
      { color: 'YELLOW', direction: 'SW', cells: ['2,15', '3,14'] },
      { color: 'GREEN', direction: 'E', cells: ['1,15', '1,14', '1,13', '0,13', '0,14'] },
      { color: 'PURPLE', direction: 'SE', cells: ['8,8', '9,8', '9,9', '10,10'] },
      { color: 'PINK', direction: 'SW', cells: ['10,11', '11,10'] },
    ],
  },
];

/**
 * Build (and solver-verify) a showcase board. Cell contiguity is enforced
 * by ArrowPathInfo (hex-adjacency, odd-r) and overlap by BoardLayout, so a
 * typo in the tables above fails the seed instead of shipping a broken level.
 */
function buildShowcaseBoard(spec: ShowcaseSpec): BoardLayout {
  const arrows = spec.arrows.map(
    (a, i) => new ArrowPathInfo(`s${i}`, a.color, a.cells, a.direction),
  );
  const board = new BoardLayout({ rows: spec.rows, cols: spec.cols, arrows });
  if (!solver.isSolvable(board)) {
    throw new Error(`Showcase "${spec.name}" is not solvable`);
  }
  return board;
}

/**
 * Initial shop catalog. Canonical UUIDv4 ids so purchase DTOs that
 * validate @IsUUID('4') downstream accept them without a re-seed.
 */
const shopItems = [
  {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Neon Pink Theme',
    costCoins: 100,
    kind: 'COSMETIC',
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    name: 'Extra Life',
    costCoins: 50,
    kind: 'POWERUP',
  },
  {
    id: '66666666-6666-4666-8666-666666666666',
    name: 'Hint Reveal',
    costCoins: 20,
    kind: 'POWERUP',
  },
];

interface SeedItem {
  difficulty: Difficulty;
  id: string;
  board: BoardLayout;
  label: string;
  /** Overrides the arrows-count formula; showcase levels set it. */
  parTimeMs?: number;
}

async function main(): Promise<void> {
  const prisma = new PrismaService();
  await prisma.$connect();
  const repository = new PostgresLevelRepository(prisma);

  // --- 1. Figure boards (built + solver-verified in memory) ---
  const figureItems: SeedItem[] = figures.map((spec, i) => ({
    difficulty: spec.difficulty,
    id: spec.uuid,
    board: buildFigureBoard(spec, i),
    label: `figure "${spec.name}"`,
  }));

  // --- 1b. Showcase boards (built + solver-verified in memory) ---
  const showcaseItems: SeedItem[] = showcase.map((spec) => ({
    difficulty: spec.difficulty,
    id: spec.uuid,
    board: buildShowcaseBoard(spec),
    label: `showcase "${spec.name}"`,
    parTimeMs: spec.parTimeMs,
  }));

  // --- 2. Procedural boards (in memory), deterministic + idempotent ---
  // 9 EASY + 9 MEDIUM + 9 HARD from SeededRandomSource; ids from
  // SeededUuidGenerator so repeated seeds upsert the same rows.
  const generator = new RandomBoardGenerator(
    new BoardSolver(),
    new SeededRandomSource(20_260_713),
  );
  const generatedIdGen = new SeededUuidGenerator();
  const genPlan: Difficulty[] = [
    ...Array<Difficulty>(9).fill('EASY'),
    ...Array<Difficulty>(9).fill('MEDIUM'),
    ...Array<Difficulty>(9).fill('HARD'),
  ];
  const generatedItems: SeedItem[] = genPlan.map((difficulty) => ({
    difficulty,
    id: generatedIdGen.generate(),
    board: generator.generate(difficulty),
    label: 'generated',
  }));

  // --- 3. Group by difficulty, figures leading each tier ---
  // Catalog order: EASY (5 figures + 9 generated), then MEDIUM, then HARD.
  // Dense 0-based indices assigned in this order so the app shows a clean
  // easy -> medium -> hard progression with the figures up front.
  const order: Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];
  // Showcase leads: indices 0..4, reachable without unlocking anything.
  const ordered: SeedItem[] = [...showcaseItems];
  for (const diff of order) {
    ordered.push(...figureItems.filter((it) => it.difficulty === diff));
    ordered.push(...generatedItems.filter((it) => it.difficulty === diff));
  }

  // --- 4. Assign indices and persist in catalog order ---
  for (let index = 0; index < ordered.length; index++) {
    const item = ordered[index];
    const profile = profileFor(item.difficulty);
    const parTimeMs =
      item.parTimeMs ??
      Math.floor(
        item.board.arrows.length * 15_000 * profile.parTimeMultiplier(),
      );
    const level = new Level({
      id: item.id,
      index,
      difficulty: profile,
      board: item.board,
      parTimeMs,
      published: true,
    });
    await repository.save(level);
    console.log(
      `Seeded index=${index} difficulty=${profile.label()} ` +
        `arrows=${item.board.arrows.length} ${item.label} id=${item.id}`,
    );
  }
  console.log(
    `Levels done. ${ordered.length} total ` +
      `(${showcaseItems.length} showcase + ${figureItems.length} figures + ` +
      `${generatedItems.length} generated), ` +
      `grouped by difficulty.`,
  );

  // --- 5. Shop items (upsert-by-id, unchanged) ---
  for (const item of shopItems) {
    await prisma.shopItem.upsert({
      where: { id: item.id },
      create: item,
      update: item,
    });
  }
  console.log(`Seeded ${shopItems.length} shop items.`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Seed failed:', error);
  throw error;
});
