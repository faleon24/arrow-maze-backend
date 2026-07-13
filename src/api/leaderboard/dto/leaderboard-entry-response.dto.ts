import { LeaderboardEntry } from '../../../domain/models/leaderboard-entry';

/**
 * LeaderboardEntryResponseDto — one row of the leaderboard as it
 * crosses the HTTP boundary. Domain values are unwrapped into JSON
 * primitives; the Date becomes an ISO 8601 string.
 */
export class LeaderboardEntryResponseDto {
  userDisplayName!: string;
  stars!: number;
  timeMs!: number;
  completedAt!: string;

  static fromDomain(entry: LeaderboardEntry): LeaderboardEntryResponseDto {
    const dto = new LeaderboardEntryResponseDto();
    dto.userDisplayName = entry.userDisplayName;
    dto.stars = entry.stars;
    dto.timeMs = entry.timeMs;
    dto.completedAt = entry.completedAt.toISOString();
    return dto;
  }
}