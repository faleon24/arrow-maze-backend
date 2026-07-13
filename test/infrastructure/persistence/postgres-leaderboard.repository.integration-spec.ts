import { PrismaClient } from '@prisma/client';
import { ArrowPathInfo } from '../../../src/domain/models/arrow-path-info';
import { BoardLayout } from '../../../src/domain/models/board-layout';
import { EasyProfile } from '../../../src/domain/models/difficulty-profile';
import { Level } from '../../../src/domain/models/level';
import { PostgresLeaderboardRepository } from '../../../src/infrastructure/persistence/postgres-leaderboard.repository';
import { PostgresLevelRepository } from '../../../src/infrastructure/persistence/postgres-level.repository';
import { PrismaService } from '../../../src/infrastructure/persistence/prisma.service';
import { DatabaseCleaner } from '../helpers/database-cleaner';

/**
 * Integration tests for PostgresLeaderboardRepository.
 *
 * Seeds several users with different scores on the same level, then
 * verifies the repository returns them in leaderboard order (stars
 * desc, timeMs asc, completedAt asc) and respects the limit.
 */
describe('PostgresLeaderboardRepository (integration)', () => {
  let prisma: PrismaService;
  let repository: PostgresLeaderboardRepository;
  let levelRepo: PostgresLevelRepository;
  let cleaner: DatabaseCleaner;

  const LEVEL_ID = 'level-1';

  const buildSeedLevel = (id: string, index: number): Level =>
    new Level({
      id,
      index,
      difficulty: new EasyProfile(),
      board: new BoardLayout({
        rows: 3,
        cols: 3,
        arrows: [new ArrowPathInfo('a1', 'PINK', ['1,1'], 'UP')],
      }),
      parTimeMs: 60_000,
      published: true,
    });

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    repository = new PostgresLeaderboardRepository(prisma);
    levelRepo = new PostgresLevelRepository(prisma);
    cleaner = new DatabaseCleaner(prisma as unknown as PrismaClient);
  });

  beforeEach(async () => {
    await levelRepo.save(buildSeedLevel(LEVEL_ID, 0));
  });

  afterEach(async () => {
    await cleaner.cleanAll();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const seedUserAndEntry = async (
    userId: string,
    displayName: string,
    stars: number,
    timeMs: number,
    completedAt: Date,
  ) => {
    await prisma.user.create({
      data: {
        id: userId,
        email: `${userId}@example.com`,
        passwordHash: 'not-a-real-hash',
        displayName,
      },
    });
    await prisma.progressEntry.create({
      data: {
        id: `entry-${userId}`,
        userId,
        levelId: LEVEL_ID,
        moves: 5,
        timeMs,
        stars,
        attempts: 1,
        completedAt,
      },
    });
  };

  it('should_return_entries_ordered_by_stars_desc_then_time_asc', async () => {
    // Arrange
    await seedUserAndEntry(
      'alice',
      'Alice',
      3,
      50_000,
      new Date('2026-01-01T00:00:00Z'),
    );
    await seedUserAndEntry(
      'bob',
      'Bob',
      2,
      30_000,
      new Date('2026-01-02T00:00:00Z'),
    );
    await seedUserAndEntry(
      'carol',
      'Carol',
      3,
      40_000,
      new Date('2026-01-03T00:00:00Z'),
    );

    // Act
    const rows = await repository.findTopByLevel(LEVEL_ID, 10);

    // Assert — Carol (3★, 40s) < Alice (3★, 50s) < Bob (2★)
    expect(rows).toHaveLength(3);
    expect(rows[0].userDisplayName).toBe('Carol');
    expect(rows[1].userDisplayName).toBe('Alice');
    expect(rows[2].userDisplayName).toBe('Bob');
  });

  it('should_break_ties_by_completed_at_asc_when_stars_and_time_match', async () => {
    // Arrange
    await seedUserAndEntry(
      'alice',
      'Alice',
      3,
      50_000,
      new Date('2026-01-05T00:00:00Z'),
    );
    await seedUserAndEntry(
      'bob',
      'Bob',
      3,
      50_000,
      new Date('2026-01-01T00:00:00Z'),
    );

    // Act
    const rows = await repository.findTopByLevel(LEVEL_ID, 10);

    // Assert — Bob completed earlier so ranks higher on the tie.
    expect(rows).toHaveLength(2);
    expect(rows[0].userDisplayName).toBe('Bob');
    expect(rows[1].userDisplayName).toBe('Alice');
  });

  it('should_respect_the_limit_when_more_entries_exist', async () => {
    // Arrange
    await seedUserAndEntry(
      'alice',
      'Alice',
      3,
      10_000,
      new Date('2026-01-01T00:00:00Z'),
    );
    await seedUserAndEntry(
      'bob',
      'Bob',
      2,
      20_000,
      new Date('2026-01-02T00:00:00Z'),
    );
    await seedUserAndEntry(
      'carol',
      'Carol',
      1,
      30_000,
      new Date('2026-01-03T00:00:00Z'),
    );

    // Act
    const rows = await repository.findTopByLevel(LEVEL_ID, 2);

    // Assert
    expect(rows).toHaveLength(2);
    expect(rows[0].userDisplayName).toBe('Alice');
    expect(rows[1].userDisplayName).toBe('Bob');
  });

  it('should_return_empty_when_no_entries_exist_for_level', async () => {
    // Act
    const rows = await repository.findTopByLevel(LEVEL_ID, 10);

    // Assert
    expect(rows).toHaveLength(0);
  });
});