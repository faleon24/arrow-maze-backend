import { DomainError } from './domain-error';

/**
 * LevelNotFoundError — raised when a client requests a level that does
 * not exist (unknown id or index).
 *
 * Unlike a corrupt-data guard (which throws a plain Error and becomes a
 * 500 because it "should never happen"), this is a legitimate,
 * client-facing business condition: the caller asked for something that
 * genuinely is not there. It therefore extends DomainError and is
 * mapped to 404 by the DomainExceptionFilter.
 */
export class LevelNotFoundError extends DomainError {
  readonly code = 'LEVEL_NOT_FOUND';

  constructor(levelId: string) {
    super(`Level not found: ${levelId}`);
  }
}