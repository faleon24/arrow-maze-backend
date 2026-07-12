/**
 * LeaderboardEntry — one row in the leaderboard for a level.
 *
 * A snapshot of a player's best run for a specific level: who they are
 * (userDisplayName), how well they did (stars, timeMs), and when they
 * first cleared it (completedAt). Immutable value object; ordering (by
 * stars desc, timeMs asc, completedAt asc) is a use-case concern, not
 * the VO's — this class only guards field invariants.
 *
 * Guarded invariants:
 *   - displayName is non-blank
 *   - stars is an integer 0..3
 *   - timeMs is a non-negative integer
 * A stale row that violates any of these fails fast at construction,
 * so the repository cannot silently emit garbage into the leaderboard.
 */
export class LeaderboardEntry {
  public readonly userDisplayName: string;
  public readonly stars: number;
  public readonly timeMs: number;
  public readonly completedAt: Date;

  constructor(props: {
    userDisplayName: string;
    stars: number;
    timeMs: number;
    completedAt: Date;
  }) {
    if (!props.userDisplayName.trim()) {
      throw new Error('LeaderboardEntry: userDisplayName must be non-blank');
    }
    if (!Number.isInteger(props.stars) || props.stars < 0 || props.stars > 3) {
      throw new Error('LeaderboardEntry: stars must be an integer 0..3');
    }
    if (!Number.isInteger(props.timeMs) || props.timeMs < 0) {
      throw new Error('LeaderboardEntry: timeMs must be a non-negative integer');
    }

    this.userDisplayName = props.userDisplayName;
    this.stars = props.stars;
    this.timeMs = props.timeMs;
    this.completedAt = props.completedAt;
  }

  equals(other: LeaderboardEntry): boolean {
    return (
      this.userDisplayName === other.userDisplayName &&
      this.stars === other.stars &&
      this.timeMs === other.timeMs &&
      this.completedAt.getTime() === other.completedAt.getTime()
    );
  }
}