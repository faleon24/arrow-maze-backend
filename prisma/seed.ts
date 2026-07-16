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
import { GenerateLevelUseCase } from '../src/application/usecases/levels/generate-level.usecase';
import { IIdGenerator } from '../src/application/ports/out/id-generator.port';

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
// from one edge: cells are ordered from that edge inward, and each is
// given a direction whose ray to the border never crosses a cell removed
// later. That makes the board solvable BY CONSTRUCTION (a valid clearing
// order exists — the peel order), while still choosing randomly among the
// valid directions per cell so the arrows look varied rather than all
// pointing the same way. BoardSolver.isSolvable double-checks every board
// before it ships.

type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
type PeelAxis = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

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

const DELTA: Record<PeelAxis, { dr: number; dc: number }> = {
  UP: { dr: -1, dc: 0 },
  DOWN: { dr: 1, dc: 0 },
  LEFT: { dr: 0, dc: -1 },
  RIGHT: { dr: 0, dc: 1 },
};

/** Is the ray from (r,c) toward `dir` clear of every cell in `present`? */
function rayClear(
  r: number,
  c: number,
  dir: PeelAxis,
  rows: number,
  cols: number,
  present: Set<string>,
): boolean {
  const { dr, dc } = DELTA[dir];
  let rr = r + dr;
  let cc = c + dc;
  while (rr >= 0 && rr < rows && cc >= 0 && cc < cols) {
    if (present.has(`${rr},${cc}`)) return false;
    rr += dr;
    cc += dc;
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
      case 'UP':
        return a.r - b.r || a.c - b.c;
      case 'DOWN':
        return b.r - a.r || a.c - b.c;
      case 'LEFT':
        return a.c - b.c || a.r - b.r;
      case 'RIGHT':
        return b.c - a.c || a.r - b.r;
    }
  });
  const present = new Set(cells.map((c) => `${c.r},${c.c}`));
  const dirs = new Map<string, PeelAxis>();
  for (const cell of order) {
    const key = `${cell.r},${cell.c}`;
    present.delete(key);
    const candidates = (['UP', 'DOWN', 'LEFT', 'RIGHT'] as PeelAxis[]).filter(
      (d) => rayClear(cell.r, cell.c, d, rows, cols, present),
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

function buildFigureLevel(spec: FigureSpec, index: number): Level {
  const rows = spec.pattern.length;
  const cols = Math.max(...spec.pattern.map((l) => l.length));
  const cells = patternToCells(spec.pattern);
  const rng = makeRng(0x9e37 + index * 2654435761);
  const axis = (['UP', 'DOWN', 'LEFT', 'RIGHT'] as PeelAxis[])[index % 4];
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
  return new Level({
    id: spec.uuid,
    index,
    difficulty: profileFor(spec.difficulty),
    board,
    parTimeMs: arrows.length * 15_000,
    published: true,
  });
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

async function main(): Promise<void> {
  const prisma = new PrismaService();
  await prisma.$connect();
  const repository = new PostgresLevelRepository(prisma);

  // --- 1. Hand-crafted FIGURE levels (indices 0-14) ---
  for (let i = 0; i < figures.length; i++) {
    const level = buildFigureLevel(figures[i], i);
    await repository.save(level);
    console.log(
      `Seeded figure "${figures[i].name}" index=${level.index} ` +
        `difficulty=${level.difficulty.label()} arrows=${level.board.arrows.length} id=${level.id}`,
    );
  }

  // --- 2. Procedurally generated levels (indices 15-41) ---
  //
  // 9 EASY + 9 MEDIUM + 9 HARD = 27 additional puzzles, deterministic via
  // SeededRandomSource + SeededUuidGenerator so the seed stays idempotent.
  const generator = new RandomBoardGenerator(
    new BoardSolver(),
    new SeededRandomSource(20_260_713),
  );
  const generatedIdGen = new SeededUuidGenerator();
  const generateLevel = new GenerateLevelUseCase(
    repository,
    generator,
    generatedIdGen,
  );
  const plan: string[] = [
    ...Array(9).fill('EASY'),
    ...Array(9).fill('MEDIUM'),
    ...Array(9).fill('HARD'),
  ];
  for (const difficulty of plan) {
    const level = await generateLevel.execute({ difficulty });
    console.log(
      `Generated level index=${level.index} difficulty=${level.difficulty.label()} arrows=${level.board.arrows.length} id=${level.id}`,
    );
  }
  console.log(
    `Levels done. ${figures.length + plan.length} total ` +
      `(${figures.length} hand-crafted figures + ${plan.length} generated).`,
  );

  // --- 3. Shop items (upsert-by-id, unchanged) ---
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
