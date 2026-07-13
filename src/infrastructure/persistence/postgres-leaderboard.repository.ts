import { Injectable } from '@nestjs/common';
import { LeaderboardEntry } from '../../domain/models/leaderboard-entry';
import { ILeaderboardRepository } from '../../application/ports/out/leaderboard-repository.port';
import { PrismaService } from './prisma.service';

/**
 * PostgresLeaderboardRepository — Prisma adapter for the leaderboard port.
 *
 * The leaderboard is derived from ProgressEntry joined to User: one row
 * per (user, level) with the user's best score. Ordering is (stars
 * desc, timeMs asc, completedAt asc): more stars first, then quicker
 * runs, then earliest completion as a stable tie-break so ties never
 * flip on refresh.
 *
 * Postgres does the sort — pushing ORDER BY into SQL is orders of
 * magnitude cheaper than shuffling arrays in JS, and the planner can
 * use the (userId, levelId) unique index for the levelId equality.
 */
@Injectable()
export class PostgresLeaderboardRepository implements ILeaderboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findTopByLevel(
    levelId: string,
    limit: number,
  ): Promise<LeaderboardEntry[]> {
    const rows = await this.prisma.progressEntry.findMany({
      where: { levelId },
      orderBy: [
        { stars: 'desc' },
        { timeMs: 'asc' },
        { completedAt: 'asc' },
      ],
      take: limit,
      include: { user: { select: { displayName: true } } },
    });

    return rows.map(
      (row) =>
        new LeaderboardEntry({
          userDisplayName: row.user.displayName,
          stars: row.stars,
          timeMs: row.timeMs,
          completedAt: row.completedAt,
        }),
    );
  }
}