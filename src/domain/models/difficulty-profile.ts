import { Score } from './score';

/**
 * DifficultyProfile — Strategy (GoF, behavioral).
 *
 * Encapsulates everything that varies between difficulty tiers behind
 * a single stable interface: how lenient the par time is, how a raw
 * performance translates into stars, and how many stars are needed to
 * unlock progression. Each concrete tier is a self-contained algorithm.
 *
 * Why a Strategy hierarchy instead of an enum: the project forbids
 * enums, and — more importantly — an enum would only name the tiers,
 * forcing every caller to switch over them to get behavior. Here the
 * behavior lives WITH the tier (polymorphism), so callers just ask the
 * profile and never branch. Adding a fourth tier (e.g. "EXPERT") means
 * adding one subclass, touching no existing code (OCP).
 *
 * Instances are stateless and interchangeable; the DifficultyProfileFactory
 * is responsible for producing the right one from a persisted label.
 */
export abstract class DifficultyProfile {
  /** Stable, machine-readable identifier persisted on the Level row. */
  abstract label(): string;

  /**
   * Multiplier applied to a level's base par time. Easier tiers are
   * more forgiving (>1), harder tiers are stricter (<1).
   */
  abstract parTimeMultiplier(): number;

  /**
   * Minimum number of stars a player must earn on a level of this tier
   * before the next one unlocks.
   */
  abstract unlockThreshold(): number;

  /**
   * Grade a completed run into a star rating (1-3). Finishing always
   * earns at least one star; faster completions earn more, with each
   * tier applying its own time thresholds.
   */
  abstract starsFromScore(score: Score): number;
}

/**
 * EasyProfile — the most forgiving tier. Generous time budget, low
 * unlock bar. Aimed at onboarding players.
 */
export class EasyProfile extends DifficultyProfile {
  private static readonly THREE_STAR_MS = 120_000; // 2 min
  private static readonly TWO_STAR_MS = 240_000; // 4 min

  label(): string {
    return 'EASY';
  }

  parTimeMultiplier(): number {
    return 1.5;
  }

  unlockThreshold(): number {
    return 1;
  }

  starsFromScore(score: Score): number {
    if (score.timeMs <= EasyProfile.THREE_STAR_MS) return 3;
    if (score.timeMs <= EasyProfile.TWO_STAR_MS) return 2;
    return 1;
  }
}

/**
 * MediumProfile — the balanced tier. Par time as designed, moderate
 * unlock bar.
 */
export class MediumProfile extends DifficultyProfile {
  private static readonly THREE_STAR_MS = 90_000; // 1.5 min
  private static readonly TWO_STAR_MS = 180_000; // 3 min

  label(): string {
    return 'MEDIUM';
  }

  parTimeMultiplier(): number {
    return 1.0;
  }

  unlockThreshold(): number {
    return 2;
  }

  starsFromScore(score: Score): number {
    if (score.timeMs <= MediumProfile.THREE_STAR_MS) return 3;
    if (score.timeMs <= MediumProfile.TWO_STAR_MS) return 2;
    return 1;
  }
}

/**
 * HardProfile — the strict tier. Tight time budget, high unlock bar.
 * Aimed at players seeking a challenge.
 */
export class HardProfile extends DifficultyProfile {
  private static readonly THREE_STAR_MS = 60_000; // 1 min
  private static readonly TWO_STAR_MS = 120_000; // 2 min

  label(): string {
    return 'HARD';
  }

  parTimeMultiplier(): number {
    return 0.75;
  }

  unlockThreshold(): number {
    return 3;
  }

  starsFromScore(score: Score): number {
    if (score.timeMs <= HardProfile.THREE_STAR_MS) return 3;
    if (score.timeMs <= HardProfile.TWO_STAR_MS) return 2;
    return 1;
  }
}