import {
  DifficultyProfile,
  EasyProfile,
  HardProfile,
  MediumProfile,
} from '../../../src/domain/models/difficulty-profile';
import { Score } from '../../../src/domain/models/score';

/** A Score with a given completion time; other fields are irrelevant here. */
function scoreWithTime(timeMs: number): Score {
  return new Score(10, timeMs, 1);
}

describe('DifficultyProfile', () => {
  describe('labels', () => {
    it('should_report_its_label_when_asked', () => {
      // Arrange
      const profiles: Array<[DifficultyProfile, string]> = [
        [new EasyProfile(), 'EASY'],
        [new MediumProfile(), 'MEDIUM'],
        [new HardProfile(), 'HARD'],
      ];

      // Act & Assert
      for (const [profile, expected] of profiles) {
        expect(profile.label()).toBe(expected);
      }
    });
  });

  describe('parTimeMultiplier ordering', () => {
    it('should_be_more_lenient_for_easier_tiers', () => {
      // Arrange
      const easy = new EasyProfile();
      const medium = new MediumProfile();
      const hard = new HardProfile();

      // Act & Assert
      expect(easy.parTimeMultiplier()).toBeGreaterThan(
        medium.parTimeMultiplier(),
      );
      expect(medium.parTimeMultiplier()).toBeGreaterThan(
        hard.parTimeMultiplier(),
      );
    });
  });

  describe('unlockThreshold ordering', () => {
    it('should_demand_more_stars_for_harder_tiers', () => {
      // Arrange
      const easy = new EasyProfile();
      const medium = new MediumProfile();
      const hard = new HardProfile();

      // Act & Assert
      expect(easy.unlockThreshold()).toBeLessThan(medium.unlockThreshold());
      expect(medium.unlockThreshold()).toBeLessThan(hard.unlockThreshold());
    });
  });

  describe('starsFromScore', () => {
    it('should_award_three_stars_when_finished_fast_on_easy', () => {
      // Arrange
      const easy = new EasyProfile();
      const fastRun = scoreWithTime(60_000); // under the 2 min threshold

      // Act
      const stars = easy.starsFromScore(fastRun);

      // Assert
      expect(stars).toBe(3);
    });

    it('should_award_at_least_one_star_when_finished_slowly', () => {
      // Arrange
      const hard = new HardProfile();
      const slowRun = scoreWithTime(600_000); // 10 min, well over any threshold

      // Act
      const stars = hard.starsFromScore(slowRun);

      // Assert
      expect(stars).toBe(1);
    });

    it('should_grade_the_same_run_more_harshly_on_a_harder_tier', () => {
      // Arrange
      const run = scoreWithTime(100_000); // ~1.67 min
      const easy = new EasyProfile();
      const hard = new HardProfile();

      // Act
      const starsOnEasy = easy.starsFromScore(run);
      const starsOnHard = hard.starsFromScore(run);

      // Assert
      expect(starsOnEasy).toBeGreaterThan(starsOnHard);
    });
  });
});