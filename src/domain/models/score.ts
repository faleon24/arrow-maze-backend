/**
 * Score value object.
 *
 * Captures how a player performed on a level: how many moves they
 * used, how long they took, and how many stars that performance
 * earned (0-3). Once constructed it is immutable — a new attempt
 * produces a new Score, never a mutation of an existing one.
 *
 * SRP: this class only knows what a valid score looks like and how
 * two scores compare. It does NOT decide how many stars a run
 * deserves — that judgement is difficulty-dependent and lives in the
 * DifficultyProfile strategy. Score is the data; the profile is the
 * algorithm that grades it.
 */
export class Score {
  private readonly _moves: number;
  private readonly _timeMs: number;
  private readonly _stars: number;

  private static readonly MIN_STARS = 0;
  private static readonly MAX_STARS = 3;

  constructor(moves: number, timeMs: number, stars: number) {
    Score.assertNonNegativeInteger(moves, 'moves');
    Score.assertNonNegativeInteger(timeMs, 'timeMs');
    Score.assertNonNegativeInteger(stars, 'stars');

    if (stars > Score.MAX_STARS) {
      throw new Error(
        `stars cannot exceed ${Score.MAX_STARS}, got ${stars}`,
      );
    }

    this._moves = moves;
    this._timeMs = timeMs;
    this._stars = stars;
  }

  get moves(): number {
    return this._moves;
  }

  get timeMs(): number {
    return this._timeMs;
  }

  get stars(): number {
    return this._stars;
  }

  /**
   * Comparable ordering, best-first. A negative result means THIS
   * score ranks ahead of `other` (i.e. is better). The ranking is:
   *   1. more stars is better,
   *   2. on a tie, fewer moves is better,
   *   3. on a tie, less time is better.
   * This is the exact order a leaderboard sorts by.
   */
  compareTo(other: Score): number {
    if (this._stars !== other._stars) {
      return other._stars - this._stars;
    }
    if (this._moves !== other._moves) {
      return this._moves - other._moves;
    }
    return this._timeMs - other._timeMs;
  }

  /**
   * Structural equality: two Scores are equal iff all three
   * components match.
   */
  equals(other: Score): boolean {
    if (!(other instanceof Score)) {
      return false;
    }
    return (
      this._moves === other._moves &&
      this._timeMs === other._timeMs &&
      this._stars === other._stars
    );
  }

  toString(): string {
    return `Score(moves=${this._moves}, timeMs=${this._timeMs}, stars=${this._stars})`;
  }

  // ---------- Private helpers ----------

  private static assertNonNegativeInteger(value: number, field: string): void {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      throw new Error(`${field} must be an integer`);
    }
    if (value < Score.MIN_STARS) {
      throw new Error(`${field} cannot be negative, got ${value}`);
    }
  }
}