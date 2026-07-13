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
/**
 * Database seed for the level catalog.
 *
 * Every level is built as a real domain aggregate (Level + BoardLayout
 * + ArrowPathInfo + DifficultyProfile) and persisted through the actual
 * PostgresLevelRepository — never with raw SQL. This means each seeded
 * level passes the exact same domain validation as production writes:
 * an invalid board (overlapping arrows, a segment off the grid, a
 * non-contiguous path) would fail HERE, at construction, instead of
 * inserting corrupt data. The seed is therefore a guarantee that the
 * starting catalog is valid by construction.
 *
 * Fixed UUIDs make the seed idempotent: save() upserts by id, so
 * running it repeatedly refreshes these three levels rather than
 * accumulating duplicates. Fase 8 replaces this transitional 3-level
 * catalog with a hand-crafted 15-level one across three difficulties.
 *
 * Shop items are seeded alongside levels using canonical UUIDv4 ids
 * so future admin/purchase DTOs validating @IsUUID('4') accept them.
 */

/**
 * Level 1 (EASY) — a 2x2 board where every arrow points straight off
 * the edge. All four are clearable from the start, in any order. The
 * gentlest possible introduction to the "tap an arrow to fire its ray
 * off the board" mechanic.
 */
function buildLevelOne(): Level {
  const board = new BoardLayout({
    rows: 2,
    cols: 2,
    arrows: [
      new ArrowPathInfo('a1', 'PINK', ['0,0'], 'UP'),
      new ArrowPathInfo('a2', 'GREEN', ['0,1'], 'RIGHT'),
      new ArrowPathInfo('a3', 'BLUE', ['1,0'], 'LEFT'),
      new ArrowPathInfo('a4', 'YELLOW', ['1,1'], 'DOWN'),
    ],
  });
  return new Level({
    id: '00000000-0000-0000-0000-000000000001',
    index: 0,
    difficulty: new EasyProfile(),
    board,
    parTimeMs: 120_000,
    published: true,
  });
}
/**
 * Level 2 (MEDIUM) — a 3x3 board that introduces blocking. In the top
 * row, two right-pointing arrows sit in a line: the inner one (0,0) is
 * blocked by the outer one (0,1), so the outer must be cleared first.
 * The right column clears downward with the same pattern. Teaches
 * "clear the outer arrow to free the inner one".
 */
function buildLevelTwo(): Level {
  const board = new BoardLayout({
    rows: 3,
    cols: 3,
    arrows: [
      new ArrowPathInfo('a1', 'PINK', ['0,0'], 'RIGHT'),
      new ArrowPathInfo('a2', 'GREEN', ['0,1'], 'RIGHT'),
      new ArrowPathInfo('a3', 'BLUE', ['1,2'], 'DOWN'),
      new ArrowPathInfo('a4', 'YELLOW', ['2,2'], 'DOWN'),
      new ArrowPathInfo('a5', 'PURPLE', ['2,0'], 'LEFT'),
    ],
  });
  return new Level({
    id: '00000000-0000-0000-0000-000000000002',
    index: 1,
    difficulty: new MediumProfile(),
    board,
    parTimeMs: 100_000,
    published: true,
  });
}
/**
 * Level 3 (HARD) — a 4x4 board with multiple blocking chains. A valid
 * clearing sequence exists (release edge-facing arrows first to open
 * lanes, then the inner ones), but no single obvious first move solves
 * it. The seed test in Fase 8 will pin this via BoardSolver.
 */
function buildLevelThree(): Level {
  const board = new BoardLayout({
    rows: 4,
    cols: 4,
    arrows: [
      new ArrowPathInfo('a1', 'PINK', ['0,1'], 'UP'),
      new ArrowPathInfo('a2', 'GREEN', ['0,3'], 'LEFT'),
      new ArrowPathInfo('a3', 'BLUE', ['1,0'], 'RIGHT'),
      new ArrowPathInfo('a4', 'YELLOW', ['1,2'], 'UP'),
      new ArrowPathInfo('a5', 'PURPLE', ['2,1'], 'DOWN'),
      new ArrowPathInfo('a6', 'PINK', ['2,3'], 'DOWN'),
      new ArrowPathInfo('a7', 'GREEN', ['3,2'], 'LEFT'),
    ],
  });
  return new Level({
    id: '00000000-0000-0000-0000-000000000003',
    index: 2,
    difficulty: new HardProfile(),
    board,
    parTimeMs: 90_000,
    published: true,
  });
}

/**
 * Initial shop catalog. Canonical UUIDv4 ids so purchase DTOs that
 * validate @IsUUID('4') downstream accept them without a re-seed.
 * Kept small (3 items across the two whitelisted kinds); Fase 8+ can
 * expand as gameplay features land.
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

  // Levels — built via domain constructors so invariants are enforced.
  const repository = new PostgresLevelRepository(prisma);
  const levels = [buildLevelOne(), buildLevelTwo(), buildLevelThree()];
  for (const level of levels) {
    await repository.save(level);
    console.log(
      `Seeded level index=${level.index} difficulty=${level.difficulty.label()} id=${level.id}`,
    );
  }
  console.log(`Done. ${levels.length} levels seeded.`);

  // Shop items — upsert-by-id so the seed is idempotent.
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