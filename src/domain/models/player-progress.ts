import { LevelProgressEntry } from './level-progress-entry';
import { Score } from './score';

/**
 * PlayerProgress — aggregate root for one player's progress across all
 * levels.
 *
 * Holds one LevelProgressEntry per level the player has completed and
 * owns the rules for how that collection changes. This is where the
 * "best score wins" business rule lives: neither the controller, nor
 * the use case, nor SQL decides it — the aggregate does, using
 * Score.compareTo. Keeping the rule here is what makes it testable in
 * isolation and defensible as domain logic.
 *
 * The internal collection is keyed by levelId for O(1) lookup, but is
 * never exposed mutably: callers get a read-only array or a single
 * entry, never the live map.
 */
export class PlayerProgress {
  private readonly _userId: string;
  private readonly _entries: Map<string, LevelProgressEntry>;

  constructor(userId: string, entries: LevelProgressEntry[] = []) {
    if (typeof userId !== 'string' || userId.trim().length === 0) {
      throw new Error('PlayerProgress userId must be a non-empty string');
    }

    this._userId = userId.trim();
    this._entries = new Map();
    for (const entry of entries) {
      if (!(entry instanceof LevelProgressEntry)) {
        throw new Error('every entry must be a LevelProgressEntry');
      }
      this._entries.set(entry.levelId, entry);
    }
  }

  get userId(): string {
    return this._userId;
  }

  /**
   * All entries as a read-only array. Order is insertion order, which
   * the repository normalizes (e.g. by level) when it matters.
   */
  get entries(): readonly LevelProgressEntry[] {
    return Array.from(this._entries.values());
  }

  /**
   * The player's standing on one level, or null if never played.
   */
  bestFor(levelId: string): LevelProgressEntry | null {
    return this._entries.get(levelId) ?? null;
  }

  /**
   * Record an attempt on a level with the given score. If the player
   * has played this level before, the existing entry is advanced
   * (attempt counted, better score kept). If not, a brand-new entry is
   * created with one attempt. Mutates this aggregate's collection and
   * returns the resulting entry for convenience.
   */
  record(levelId: string, score: Score, completedAt: Date): LevelProgressEntry {
    if (!(score instanceof Score)) {
      throw new Error('record requires a Score');
    }

    const existing = this._entries.get(levelId) ?? null;

    const entry =
      existing === null
        ? new LevelProgressEntry({
            levelId,
            bestScore: score,
            attempts: 1,
            completedAt,
          })
        : existing.withNewAttempt(score);

    this._entries.set(entry.levelId, entry);
    return entry;
  }
}