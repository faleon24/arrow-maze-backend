import { BoardLayout } from './board-layout';
import { DifficultyProfile } from './difficulty-profile';
/**
 * Level entity.
 *
 * A puzzle definition the backend stores and serves to the app: its
 * ordering index, its difficulty (as a DifficultyProfile strategy, not
 * a raw label), its board layout, a base par time, and an optional
 * hard time limit. Identity is the id — two Level instances with the
 * same id are the same level even if other fields were edited.
 *
 * Publication lifecycle: a level starts unpublished and is only served
 * to players once published. publish()/retire() model that transition
 * (the UML's Level.publish()/retire()).
 *
 * timeLimitMs (v2): if null, the level has no wall-clock deadline; if
 * a positive integer, the app must count down and fail the run when
 * the timer expires. Separates "target time for stars" (parTimeMs)
 * from "lose condition" (timeLimitMs) — a level can have a lenient
 * limit but a tight par, or no limit at all.
 *
 * Note the difficulty is already a DifficultyProfile here, never a
 * string. The string label lives only at the persistence boundary; the
 * LevelMapper uses DifficultyProfileFactory to turn it into this
 * strategy when reading a row, so the domain always holds behavior,
 * not a flag.
 */
export class Level {
  private readonly _id: string;
  private readonly _index: number;
  private readonly _difficulty: DifficultyProfile;
  private readonly _board: BoardLayout;
  private readonly _parTimeMs: number;
  private readonly _timeLimitMs: number | null;
  private _published: boolean;
  constructor(params: {
    id: string;
    index: number;
    difficulty: DifficultyProfile;
    board: BoardLayout;
    parTimeMs: number;
    timeLimitMs?: number | null;
    published?: boolean;
  }) {
    const {
      id,
      index,
      difficulty,
      board,
      parTimeMs,
      timeLimitMs = null,
      published = false,
    } = params;
    if (typeof id !== 'string' || id.trim().length === 0) {
      throw new Error('Level id must be a non-empty string');
    }
    if (!Number.isInteger(index) || index < 0) {
      throw new Error(`Level index must be a non-negative integer, got ${index}`);
    }
    if (!(difficulty instanceof DifficultyProfile)) {
      throw new Error('Level difficulty must be a DifficultyProfile');
    }
    if (!(board instanceof BoardLayout)) {
      throw new Error('Level board must be a BoardLayout');
    }
    if (!Number.isInteger(parTimeMs) || parTimeMs <= 0) {
      throw new Error(
        `Level parTimeMs must be a positive integer, got ${parTimeMs}`,
      );
    }
    if (
      timeLimitMs !== null &&
      (!Number.isInteger(timeLimitMs) || timeLimitMs <= 0)
    ) {
      throw new Error(
        `Level timeLimitMs must be null or a positive integer, got ${timeLimitMs}`,
      );
    }
    this._id = id;
    this._index = index;
    this._difficulty = difficulty;
    this._board = board;
    this._parTimeMs = parTimeMs;
    this._timeLimitMs = timeLimitMs;
    this._published = published;
  }
  get id(): string {
    return this._id;
  }
  get index(): number {
    return this._index;
  }
  get difficulty(): DifficultyProfile {
    return this._difficulty;
  }
  get board(): BoardLayout {
    return this._board;
  }
  get parTimeMs(): number {
    return this._parTimeMs;
  }
  get timeLimitMs(): number | null {
    return this._timeLimitMs;
  }
  get published(): boolean {
    return this._published;
  }
  /**
   * The effective par time for this level, after the difficulty
   * strategy's multiplier is applied. This is where the Strategy earns
   * its keep: the level holds a base time, the profile decides how
   * lenient that becomes.
   */
  effectiveParTimeMs(): number {
    return Math.round(this._parTimeMs * this._difficulty.parTimeMultiplier());
  }
  /** Make the level visible to players. Idempotent. */
  publish(): void {
    this._published = true;
  }
  /** Withdraw the level from players. Idempotent. */
  retire(): void {
    this._published = false;
  }
}