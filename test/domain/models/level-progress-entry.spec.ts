import { LevelProgressEntry } from '../../../src/domain/models/level-progress-entry';
import { Score } from '../../../src/domain/models/score';

/** A Score whose rank we control via stars (more stars = better). */
function scoreWithStars(stars: number): Score {
  return new Score(10, 60_000, stars);
}

function buildEntry(
  overrides: Partial<{
    levelId: string;
    bestScore: Score;
    attempts: number;
    completedAt: Date;
  }> = {},
): LevelProgressEntry {
  return new LevelProgressEntry({
    levelId: overrides.levelId ?? 'level-1',
    bestScore: overrides.bestScore ?? scoreWithStars(2),
    attempts: overrides.attempts ?? 1,
    completedAt: overrides.completedAt ?? new Date('2026-01-01T00:00:00.000Z'),
  });
}

describe('LevelProgressEntry', () => {
  describe('construction', () => {
    it('should_expose_its_fields_when_constructed_validly', () => {
      // Arrange
      const score = scoreWithStars(3);
      const completedAt = new Date('2026-02-02T10:00:00.000Z');

      // Act
      const entry = new LevelProgressEntry({
        levelId: 'abc',
        bestScore: score,
        attempts: 4,
        completedAt,
      });

      // Assert
      expect(entry.levelId).toBe('abc');
      expect(entry.bestScore).toBe(score);
      expect(entry.attempts).toBe(4);
      expect(entry.completedAt).toBe(completedAt);
    });

    it('should_throw_when_levelId_is_empty', () => {
      // Act & Assert
      expect(() => buildEntry({ levelId: '  ' })).toThrow();
    });

    it('should_throw_when_attempts_is_below_one', () => {
      // Act & Assert
      expect(() => buildEntry({ attempts: 0 })).toThrow();
    });

    it('should_throw_when_completedAt_is_invalid', () => {
      // Act & Assert
      expect(() => buildEntry({ completedAt: new Date('not-a-date') })).toThrow();
    });
  });

  describe('withNewAttempt', () => {
    it('should_increment_attempts_when_a_new_attempt_is_recorded', () => {
      // Arrange
      const entry = buildEntry({ attempts: 3 });

      // Act
      const advanced = entry.withNewAttempt(scoreWithStars(2));

      // Assert
      expect(advanced.attempts).toBe(4);
    });

    it('should_keep_the_better_existing_score_when_the_new_one_is_worse', () => {
      // Arrange
      const best = scoreWithStars(3);
      const entry = buildEntry({ bestScore: best });

      // Act
      const advanced = entry.withNewAttempt(scoreWithStars(1));

      // Assert
      expect(advanced.bestScore).toBe(best);
    });

    it('should_replace_the_score_when_the_new_one_is_better', () => {
      // Arrange
      const entry = buildEntry({ bestScore: scoreWithStars(1) });
      const better = scoreWithStars(3);

      // Act
      const advanced = entry.withNewAttempt(better);

      // Assert
      expect(advanced.bestScore).toBe(better);
    });

    it('should_preserve_the_original_completedAt_across_attempts', () => {
      // Arrange
      const firstCompletion = new Date('2026-01-01T00:00:00.000Z');
      const entry = buildEntry({ completedAt: firstCompletion });

      // Act
      const advanced = entry.withNewAttempt(scoreWithStars(3));

      // Assert
      expect(advanced.completedAt).toEqual(firstCompletion);
    });

    it('should_not_mutate_the_original_entry', () => {
      // Arrange
      const entry = buildEntry({ attempts: 1 });

      // Act
      entry.withNewAttempt(scoreWithStars(3));

      // Assert — the original is untouched; a new entry was returned.
      expect(entry.attempts).toBe(1);
    });
  });
});