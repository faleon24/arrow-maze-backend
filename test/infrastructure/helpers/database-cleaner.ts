import { PrismaClient } from '@prisma/client';

/**
 * DatabaseCleaner truncates test-relevant tables so each integration
 * test starts from a known empty state. Meant to be used from
 * afterEach hooks in integration specs.
 *
 * Not for production use. This class exists only under /test.
 */
export class DatabaseCleaner {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Truncates every table this project owns. RESTART IDENTITY is
   * harmless for our current schema (string IDs) but makes the helper
   * safe to reuse if we ever add auto-increment columns. CASCADE
   * covers future foreign keys.
   */
  async cleanAll(): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "users", "levels", "progress_entries" RESTART IDENTITY CASCADE;',
    );
  }
}