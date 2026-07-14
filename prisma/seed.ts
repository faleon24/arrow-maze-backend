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
 * seed script. Same run number always produces the same UUID, so
 * repeated `npx prisma db seed` calls upsert the same rows instead of
 * accumulating duplicates. Prefix `abcdef00-...` guarantees zero
 * collision with the hand-crafted UUIDs (11111.../22222.../33333...).
 *
 * NOT for production use — a real UUID generator (crypto-random) lives
 * behind the IIdGenerator port in the running application.
 */
class SeededUuidGenerator implements IIdGenerator {
  private counter = 0;

  generate(): string {
    this.counter += 1;
    const hex = this.counter.toString(16).padStart(12, '0');
    return `abcdef00-0000-4000-8000-${hex}`;
  }
}

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
    id: '11111111-1111-4111-8111-111111111111',
    index: 0,
    difficulty: new EasyProfile(),
    board,
    parTimeMs: 120_000,
    published: true,
  });
}

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
    id: '22222222-2222-4222-8222-222222222222',
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
 * it.
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
    id: '33333333-3333-4333-8333-333333333333',
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

  // --- 1. Hand-crafted levels (indices 0-2, canonical UUIDs) ---
  const handCrafted = [buildLevelOne(), buildLevelTwo(), buildLevelThree()];
  for (const level of handCrafted) {
    await repository.save(level);
    console.log(
      `Seeded hand-crafted level index=${level.index} difficulty=${level.difficulty.label()} id=${level.id}`,
    );
  }

  // --- 2. Procedurally generated levels (indices 3-29) ---
  //
  // 9 EASY + 9 MEDIUM + 9 HARD = 27 additional puzzles. Board layouts
  // come from SeededRandomSource(20260713) so every run of this script
  // produces the identical batch; UUIDs come from SeededUuidGenerator
  // so the repository upserts the same 27 rows instead of accumulating
  // duplicates. The whole seed is therefore idempotent under repeated
  // `npx prisma db seed` calls.
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
    `Levels done. ${handCrafted.length + plan.length} total (${handCrafted.length} hand-crafted + ${plan.length} generated).`,
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
