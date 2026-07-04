import { User } from '../../../domain/models/user';
import { Email } from '../../../domain/models/email';

/**
 * UserRepository outbound port.
 *
 * Declares the persistence operations the application layer needs
 * to manage users. This interface is technology-agnostic: it says
 * nothing about SQL, Postgres, tables, or ORMs. Implementations
 * live in the infrastructure layer and adapt a specific storage
 * backend to this contract.
 *
 * DIP: the use cases in the application layer depend on this
 * abstraction. Swapping Postgres for MongoDB, or a real database
 * for an in-memory fake in tests, requires zero changes here.
 */
export interface IUserRepository {
  /**
   * Look up a user by their unique identifier.
   * Returns null if no user with that id exists.
   */
  findById(id: string): Promise<User | null>;

  /**
   * Look up a user by their email address.
   * Returns null if no user with that email exists.
   */
  findByEmail(email: Email): Promise<User | null>;

  /**
   * Persist a user (insert or update, at the implementation's
   * discretion — the application should not care which).
   */
  save(user: User): Promise<void>;
}