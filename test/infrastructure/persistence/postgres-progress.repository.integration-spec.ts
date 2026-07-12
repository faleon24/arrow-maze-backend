import { PrismaClient } from '@prisma/client';
import { PostgresProgressRepository } from '../../../src/infrastructure/persistence/postgres-progress.repository';
import { PostgresLevelRepository } from '../../../src/infrastructure/persistence/postgres-level.repository';
import { PrismaService } from '../../../src/infrastructure/persistence/prisma.service';
import { IIdGenerator } from '../../../src/application/ports/out/id-generator.port';
import { PlayerProgress } from '../../../src/domain/models/player-progress';
import { Score } from '../../../src/domain/models/score';
import { Level } from '../../../src/domain/models/level';
import { BoardLayout } from '../../../src/domain/models/board-layout';
import { ArrowPathInfo } from '../../../src/domain/models/arrow-path-info';
import { EasyProfile } from '../../../src/domain/models/difficulty-profile';
import { DatabaseCleaner } from '../helpers/database-cleaner';
/**
 * Integration tests for PostgresProgressRepository.
 *
 * Exercises the adapter against a REAL PostgreSQL instance
 * (arrowmaze_test). No mocks. Proves that: the aggregate assembles
 * correctly from multiple rows, the (userId, levelId) unique constraint
 * makes save idempotent (a second attempt updates, never duplicates),
 * the best score survives a round-trip, and an unknown user yields an
 * empty aggregate rather than null.
 *
 * v2 note: since ProgressEntry now carries a foreign key to Level, a
 * beforeEach seeds the levels the tests reference (`level-1`, `level-2`)
 * so FK constraints hold. Without this, every save would fail with
 * "insert or update on table violates foreign key constraint".
 */
describe('PostgresProgressRepository (integration)', () => {
  let prisma: PrismaService;
  let repository: PostgresProgressRepository;
  let levelRepo: PostgresLevelRepository;
  let cleaner: DatabaseCleaner;
  /** Deterministic id generator: id-1, id-2, ... so tests are stable. */
  class SequentialIdGenerator implements IIdGenerator {
    private counter = 0;
    generate(): string {
      this.counter += 1;
      return `id-${this.counter}`;
    }
  }
  const USER = 'user-abc';
  const scoreWith = (stars: number, moves = 10, timeMs = 60_000): Score =>
    new Score(moves, timeMs, stars);
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
    repository = new PostgresProgressRepository(prisma, new SequentialIdGenerator());
    levelRepo = new PostgresLevelRepository(prisma);
    cleaner = new DatabaseCleaner(prisma as unknown as PrismaClient);
  });
  beforeEach(async () => {
    await prisma.user.create({
      data: {
        id: USER,
        email: `${USER}@example.com`,
        passwordHash: 'not-a-real-hash',
        displayName: 'Test User',
      },
    });
    await levelRepo.save(buildSeedLevel('level-1', 0));
    await levelRepo.save(buildSeedLevel('level-2', 1));
  });
  afterEach(async () => {
    await cleaner.cleanAll();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });
  describe('findByUser', () => {
    it('should_return_empty_progress_when_the_user_has_no_entries', async () => {
      const progress = await repository.findByUser('nobody');
      expect(progress).toBeInstanceOf(PlayerProgress);
      expect(progress.entries).toHaveLength(0);
    });
    it('should_assemble_the_aggregate_from_multiple_level_entries', async () => {
      // Arrange
      const progress = new PlayerProgress(USER);
      progress.record('level-1', scoreWith(2), new Date('2026-01-01T00:00:00.000Z'));
      progress.record('level-2', scoreWith(3), new Date('2026-01-02T00:00:00.000Z'));
      await repository.save(progress);
      // Act
      const loaded = await repository.findByUser(USER);
      // Assert
      expect(loaded.entries).toHaveLength(2);
      expect(loaded.bestFor('level-1')!.bestScore.stars).toBe(2);
      expect(loaded.bestFor('level-2')!.bestScore.stars).toBe(3);
    });
  });
  describe('save (idempotency via unique constraint)', () => {
    it('should_update_rather_than_duplicate_when_the_same_level_is_saved_twice', async () => {
      const first = await repository.findByUser(USER);
      first.record('level-1', scoreWith(1), new Date('2026-01-01T00:00:00.000Z'));
      await repository.save(first);
      const second = await repository.findByUser(USER);
      second.record('level-1', scoreWith(3), new Date('2026-01-05T00:00:00.000Z'));
      await repository.save(second);
      const loaded = await repository.findByUser(USER);
      expect(loaded.entries).toHaveLength(1);
      const entry = loaded.bestFor('level-1')!;
      expect(entry.attempts).toBe(2);
      expect(entry.bestScore.stars).toBe(3);
    });
    it('should_preserve_the_first_completion_date_across_updates', async () => {
      const firstDate = new Date('2026-01-01T00:00:00.000Z');
      const first = await repository.findByUser(USER);
      first.record('level-1', scoreWith(2), firstDate);
      await repository.save(first);
      const second = await repository.findByUser(USER);
      second.record('level-1', scoreWith(3), new Date('2026-06-06T00:00:00.000Z'));
      await repository.save(second);
      const loaded = await repository.findByUser(USER);
      expect(loaded.bestFor('level-1')!.completedAt).toEqual(firstDate);
    });
  });
  describe('round-trip integrity', () => {
    it('should_preserve_all_score_components_through_save_and_load', async () => {
      const progress = new PlayerProgress(USER);
      progress.record('level-1', scoreWith(3, 7, 42_000), new Date('2026-01-01T00:00:00.000Z'));
      await repository.save(progress);
      const loaded = await repository.findByUser(USER);
      const score = loaded.bestFor('level-1')!.bestScore;
      expect(score.moves).toBe(7);
      expect(score.timeMs).toBe(42_000);
      expect(score.stars).toBe(3);
    });
  });
});