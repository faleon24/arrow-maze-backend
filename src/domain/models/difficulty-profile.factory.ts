import {
  DifficultyProfile,
  EasyProfile,
  HardProfile,
  MediumProfile,
} from './difficulty-profile';

/**
 * DifficultyProfileFactory — Factory Method (GoF, creational).
 *
 * Turns the plain difficulty label persisted on a Level row
 * ("EASY" | "MEDIUM" | "HARD") into the matching DifficultyProfile
 * strategy instance. Callers depend only on the abstract
 * DifficultyProfile return type and never name a concrete tier, so
 * the knowledge of "which label maps to which class" lives in exactly
 * one place. Adding a new tier means one new case here and nothing
 * else across the codebase (OCP).
 *
 * A label that does not correspond to a known tier signals corrupt
 * persistence data (the seed and the level-upsert validation both
 * constrain it upstream), so it fails fast with a plain Error — the
 * same convention the value objects use for "this should never
 * happen" structural guards. The global exception filter maps such
 * errors to 500 rather than a friendly 4xx.
 */
export class DifficultyProfileFactory {
  static create(label: string): DifficultyProfile {
    const normalized =
      typeof label === 'string' ? label.trim().toUpperCase() : '';

    switch (normalized) {
      case 'EASY':
        return new EasyProfile();
      case 'MEDIUM':
        return new MediumProfile();
      case 'HARD':
        return new HardProfile();
      default:
        throw new Error(
          `Unknown difficulty profile label: ${JSON.stringify(label)}`,
        );
    }
  }
}