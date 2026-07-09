import { Score } from './score';

/**
 * LevelProgressEntry value object.
 *
 * A player's standing on a single level: their best score so far, how
 * many times they have attempted it, and when they first completed it.
 * One entry exists per (player, level) pair.
 *
 * Immutability with intent: recording a new attempt does not mutate an
 * entry in place — it returns a NEW entry. This keeps the aggregate's
 * state transitions explicit and easy to reason about (and to test),
 * mirroring how the value objects elsewhere in the domain behave.
 *
 * SRP: this class owns the rule for how one level's standing evolves
 * when a fresh attempt arrives (keep the better score, count the
 * attempt). It knows nothing about persistence or HTTP.
 */
export class LevelProgressEntry {
  private readonly _levelId: string;
  private readonly _bestScore: Score;
  private readonly _attempts: number;
  private readonly _completedAt: Date;

  constructor(params: {
    levelId: string;
    bestScore: Score;
    attempts: number;
    completedAt: Date;
  }) {
    const { levelId, bestScore, attempts, completedAt } = params;

    if (typeof levelId !== 'string' || levelId.trim().length === 0) {
      throw new Error('LevelProgressEntry levelId must be a non-empty string');
    }
    if (!(bestScore instanceof Score)) {
      throw new Error('LevelProgressEntry bestScore must be a Score');
    }
    if (!Number.isInteger(attempts) || attempts < 1) {
      throw new Error(
        `LevelProgressEntry attempts must be a positive integer, got ${attempts}`,
      );
    }
    if (!(completedAt instanceof Date) || Number.isNaN(completedAt.getTime())) {
      throw new Error('LevelProgressEntry completedAt must be a valid Date');
    }

    this._levelId = levelId.trim();
    this._bestScore = bestScore;
    this._attempts = attempts;
    this._completedAt = completedAt;
  }

  get levelId(): string {
    return this._levelId;
  }

  get bestScore(): Score {
    return this._bestScore;
  }

  get attempts(): number {
    return this._attempts;
  }

  get completedAt(): Date {
    return this._completedAt;
  }

  /**
   * Produce the entry that results from playing this level again with
   * `newScore`. Attempts always increments; the best score is kept only
   * if the new one actually beats it (Score.compareTo decides). The
   * original completedAt is preserved — it marks the FIRST completion,
   * not the latest.
   */
  withNewAttempt(newScore: Score): LevelProgressEntry {
    if (!(newScore instanceof Score)) {
      throw new Error('withNewAttempt requires a Score');
    }

    // compareTo returns < 0 when the receiver ranks ahead (is better).
    const keepsExisting = this._bestScore.compareTo(newScore) <= 0;
    const best = keepsExisting ? this._bestScore : newScore;

    return new LevelProgressEntry({
      levelId: this._levelId,
      bestScore: best,
      attempts: this._attempts + 1,
      completedAt: this._completedAt,
    });
  }
}