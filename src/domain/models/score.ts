
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


  compareTo(other: Score): number {
    if (this._stars !== other._stars) {
      return other._stars - this._stars;
    }
    if (this._moves !== other._moves) {
      return this._moves - other._moves;
    }
    return this._timeMs - other._timeMs;
  }


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