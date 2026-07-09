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

/** Level 1 — a gentle 3x3 introduction on the easy tier. */
function buildLevelOne(): Level {
  const board = new BoardLayout(3, 3, [
    new CellInfo('0,0', 'START'),
    new CellInfo('0,2', 'ARROW', 'DOWN'),
    new CellInfo('1,1', 'WALL'),
    new CellInfo('2,2', 'EXIT'),
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

/** Level 2 — a 4x4 with more arrows on the medium tier. */
function buildLevelTwo(): Level {
  const board = new BoardLayout(4, 4, [
    new CellInfo('0,0', 'START'),
    new CellInfo('0,3', 'ARROW', 'DOWN'),
    new CellInfo('1,1', 'WALL'),
    new CellInfo('2,2', 'WALL'),
    new CellInfo('3,0', 'ARROW', 'RIGHT'),
    new CellInfo('3,3', 'EXIT'),
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

/** Level 3 — a 5x5 maze on the hard tier. */
function buildLevelThree(): Level {
  const board = new BoardLayout(5, 5, [
    new CellInfo('0,0', 'START'),
    new CellInfo('0,4', 'ARROW', 'DOWN'),
    new CellInfo('1,2', 'WALL'),
    new CellInfo('2,1', 'WALL'),
    new CellInfo('2,3', 'ARROW', 'LEFT'),
    new CellInfo('3,3', 'WALL'),
    new CellInfo('4,0', 'ARROW', 'RIGHT'),
    new CellInfo('4,4', 'EXIT'),
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