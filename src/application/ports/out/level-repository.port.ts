import { Level } from '../../../domain/models/level';

/**
 * LevelRepository outbound port.
 *
 * Declares the persistence operations the application layer needs to
 * manage puzzle levels. Like every port, it is technology-agnostic:
 * it names no SQL, no Prisma, no JSON columns. The infrastructure
 * layer adapts a concrete store (Postgres) to this contract.
 *
 * DIP: use cases depend on this abstraction, never on the adapter.
 * Swapping Postgres for an in-memory fake in tests requires zero
 * changes here.
 */
export interface ILevelRepository {
  /**
   * Look up a single level by its id. Returns null if none exists.
   */
  findById(id: string): Promise<Level | null>;

  /**
   * Every level, published or not. Intended for administrative use
   * (level authoring / upsert), not for the player-facing catalog.
   */
  findAll(): Promise<Level[]>;

  /**
   * Only the levels that have been published, ordered by their index.
   * This is what the game client consumes: players never see drafts.
   */
  findAllPublished(): Promise<Level[]>;

  /**
   * Persist a level (insert or update at the implementation's
   * discretion — the application should not care which).
   */
  save(level: Level): Promise<void>;
}