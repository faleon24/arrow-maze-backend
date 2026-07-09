import { PlayerProgress } from '../../../domain/models/player-progress';

/**
 * ProgressRepository outbound port.
 *
 * Declares the persistence operations the application needs to manage a
 * player's progress. Technology-agnostic, like every port: it names no
 * SQL, no Prisma, no tables. The infrastructure layer adapts a concrete
 * store to this contract.
 *
 * The aggregate is loaded and saved as a whole (per user). findByUser
 * returns a fully-formed PlayerProgress — never a partial row — so the
 * domain rules always operate on a complete aggregate.
 *
 * DIP: use cases depend on this abstraction, never on the adapter.
 */
export interface IProgressRepository {
  /**
   * Load the full progress aggregate for a user. Returns an empty
   * PlayerProgress (no entries) if the user has never recorded any,
   * so callers never deal with null — a user always "has" progress,
   * possibly empty.
   */
  findByUser(userId: string): Promise<PlayerProgress>;

  /**
   * Persist the aggregate. The implementation upserts each entry so
   * that recording an attempt is idempotent per (user, level).
   */
  save(progress: PlayerProgress): Promise<void>;
}