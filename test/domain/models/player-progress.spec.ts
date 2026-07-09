import { PlayerProgress } from '../../../src/domain/models/player-progress';
import { LevelProgressEntry } from '../../../src/domain/models/level-progress-entry';
import { Score } from '../../../src/domain/models/score';

function scoreWithStars(stars: number): Score {
  return new Score(10, 60_000, stars);
}

const COMPLETED_AT = new Date('2026-01-01T00:00:00.000Z');

describe('PlayerProgress', () => {
  describe('construction', () => {
    it('should_start_empty_when_no_entries_are_given', () => {
      // Act
      const progress = new PlayerProgress('user-1');

      // Assert
      expect(progress.userId).toBe('user-1');
      expect(progress.entries).toHaveLength(0);
    });

    it('should_throw_when_userId_is_empty', () => {
      // Act & Assert
      expect(() => new PlayerProgress('  ')).toThrow();
    });

    it('should_load_pre_existing_entries_when_provided', () => {
      // Arrange
      const entry = new LevelProgressEntry({
        levelId: 'level-1',
        bestScore: scoreWithStars(2),
        attempts: 1,
        completedAt: COMPLETED_AT,
      });

      // Act
      const progress = new PlayerProgress('user-1', [entry]);

      // Assert
      expect(progress.entries).toHaveLength(1);
      expect(progress.bestFor('level-1')).toBe(entry);
    });
  });

  describe('bestFor', () => {
    it('should_return_null_when_the_level_was_never_played', () => {
      // Arrange
      const progress = new PlayerProgress('user-1');

      // Act & Assert
      expect(progress.bestFor('unplayed')).toBeNull();
    });
  });

  describe('record', () => {
    it('should_create_a_new_entry_with_one_attempt_when_level_is_new', () => {
      // Arrange
      const progress = new PlayerProgress('user-1');

      // Act
      const entry = progress.record('level-1', scoreWithStars(2), COMPLETED_AT);

      // Assert
      expect(entry.attempts).toBe(1);
      expect(progress.bestFor('level-1')).not.toBeNull();
      expect(progress.entries).toHaveLength(1);
    });

    it('should_advance_the_existing_entry_when_the_level_was_played_before', () => {
      // Arrange
      const progress = new PlayerProgress('user-1');
      progress.record('level-1', scoreWithStars(1), COMPLETED_AT);

      // Act
      progress.record('level-1', scoreWithStars(3), COMPLETED_AT);

      // Assert — still one entry, now with the better score and 2 attempts.
      const entry = progress.bestFor('level-1');
      expect(progress.entries).toHaveLength(1);
      expect(entry!.attempts).toBe(2);
      expect(entry!.bestScore.stars).toBe(3);
    });

    it('should_keep_the_better_score_when_a_worse_attempt_is_recorded', () => {
      // Arrange
      const progress = new PlayerProgress('user-1');
      progress.record('level-1', scoreWithStars(3), COMPLETED_AT);

      // Act
      progress.record('level-1', scoreWithStars(1), COMPLETED_AT);

      // Assert
      expect(progress.bestFor('level-1')!.bestScore.stars).toBe(3);
    });

    it('should_track_separate_entries_for_different_levels', () => {
      // Arrange
      const progress = new PlayerProgress('user-1');

      // Act
      progress.record('level-1', scoreWithStars(2), COMPLETED_AT);
      progress.record('level-2', scoreWithStars(1), COMPLETED_AT);

      // Assert
      expect(progress.entries).toHaveLength(2);
      expect(progress.bestFor('level-1')!.bestScore.stars).toBe(2);
      expect(progress.bestFor('level-2')!.bestScore.stars).toBe(1);
    });
  });
});