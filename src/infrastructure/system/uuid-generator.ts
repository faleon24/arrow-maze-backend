import { randomUUID } from 'node:crypto';
import { IIdGenerator } from '../../application/ports/out/id-generator.port';

/**
 * UuidGenerator — infrastructure adapter for IIdGenerator.
 *
 * Uses Node's built-in crypto.randomUUID() (RFC 4122 v4).
 * No external dependency required.
 *
 * Tests inject a deterministic generator (e.g. SequentialIdGenerator)
 * so that generated ids are predictable and assertable.
 *
 * Pattern: Adapter (GoF structural pattern).
 */
export class UuidGenerator implements IIdGenerator {
  generate(): string {
    return randomUUID();
  }
}