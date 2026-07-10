import 'dotenv/config';

import { PrismaService } from '../src/infrastructure/persistence/prisma.service';
import { PostgresLevelRepository } from '../src/infrastructure/persistence/postgres-level.repository';
import { Level } from '../src/domain/models/level';
import { BoardLayout } from '../src/domain/models/board-layout';
import { CellInfo } from '../src/domain/models/cell-info';
import {
  EasyProfile,
  MediumProfile,
  HardProfile,
} from '../src/domain/models/difficulty-profile';

/**
 * Database seed for the level catalog.
 *
 * Every level is built as a real domain aggregate (Level + BoardLayout
 * + CellInfo + DifficultyProfile) and persisted through the actual
 * PostgresLevelRepository — never with raw SQL. This means each seeded
 * level passes the exact same domain validation as production writes:
 * an invalid board (two starts, an arrow without a direction, a cell
 * off the grid) would fail HERE, at construction, instead of inserting
 * corrupt data. The seed is therefore a guarantee that the starting
 * catalog is valid by construction.
 *
 * Fixed UUIDs make the seed idempotent: save() upserts by id, so
 * running it repeatedly refreshes these three levels rather than
 * accumulating duplicates.
 */

/**
 * Level 1 (EASY) — a 2x2 board where every arrow points straight off the
 * edge. All four are clearable from the start, in any order. The gentlest
 * possible introduction to the "tap an arrow to send it off the board"
 * mechanic.
 */
function buildLevelOne(): Level {
  const board = new BoardLayout(2, 2, [
    new CellInfo('0,0', 'ARROW', 'UP'),
    new CellInfo('0,1', 'ARROW', 'RIGHT'),
    new CellInfo('1,0', 'ARROW', 'LEFT'),
    new CellInfo('1,1', 'ARROW', 'DOWN'),
  ]);
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
 * The remaining arrows point at open edges. Teaches "clear the outer
 * arrow to free the inner one".
 */
function buildLevelTwo(): Level {
  const board = new BoardLayout(3, 3, [
    // Top row: a blocking pair pointing right.
    new CellInfo('0,0', 'ARROW', 'RIGHT'),
    new CellInfo('0,1', 'ARROW', 'RIGHT'),
    // A column that clears downward.
    new CellInfo('1,2', 'ARROW', 'DOWN'),
    new CellInfo('2,2', 'ARROW', 'DOWN'),
    // A lone arrow pointing at the left edge.
    new CellInfo('2,0', 'ARROW', 'LEFT'),
  ]);
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
 * Level 3 (HARD) — a 4x4 board with several blocking chains that cross,
 * so the player must plan the order. A valid clearing sequence exists
 * (e.g. release the edge-facing arrows to open lanes, then the inner
 * ones), but no single obvious first move solves it.
 */
function buildLevelThree(): Level {
  const board = new BoardLayout(4, 4, [
    // Row 0: two arrows pointing up (both reach the top edge directly).
    new CellInfo('0,1', 'ARROW', 'UP'),
    new CellInfo('0,3', 'ARROW', 'LEFT'),
    // Row 1: a right-pointing pair (inner blocked by outer).
    new CellInfo('1,0', 'ARROW', 'RIGHT'),
    new CellInfo('1,2', 'ARROW', 'UP'),
    // Row 2: downward arrows.
    new CellInfo('2,1', 'ARROW', 'DOWN'),
    new CellInfo('2,3', 'ARROW', 'DOWN'),
    // Row 3: an arrow pointing at the bottom edge.
    new CellInfo('3,2', 'ARROW', 'LEFT'),
  ]);
  return new Level({
    id: '00000000-0000-0000-0000-000000000003',
    index: 2,
    difficulty: new HardProfile(),
    board,
    parTimeMs: 90_000,
    published: true,
  });
}

async function main(): Promise<void> {
  const prisma = new PrismaService();
  await prisma.$connect();

  const repository = new PostgresLevelRepository(prisma);

  const levels = [buildLevelOne(), buildLevelTwo(), buildLevelThree()];

  for (const level of levels) {
    await repository.save(level);
    console.log(
      `Seeded level index=${level.index} difficulty=${level.difficulty.label()} id=${level.id}`,
    );
  }

  console.log(`Done. ${levels.length} levels seeded.`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Seed failed:', error);
  throw error;
});