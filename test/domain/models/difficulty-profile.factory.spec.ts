import { DifficultyProfileFactory } from '../../../src/domain/models/difficulty-profile.factory';
import {
  EasyProfile,
  HardProfile,
  MediumProfile,
} from '../../../src/domain/models/difficulty-profile';

describe('DifficultyProfileFactory', () => {
  describe('create', () => {
    it('should_build_an_easy_profile_when_label_is_easy', () => {
      // Arrange
      const label = 'EASY';

      // Act
      const profile = DifficultyProfileFactory.create(label);

      // Assert
      expect(profile).toBeInstanceOf(EasyProfile);
    });

    it('should_build_a_medium_profile_when_label_is_medium', () => {
      // Arrange
      const label = 'MEDIUM';

      // Act
      const profile = DifficultyProfileFactory.create(label);

      // Assert
      expect(profile).toBeInstanceOf(MediumProfile);
    });

    it('should_build_a_hard_profile_when_label_is_hard', () => {
      // Arrange
      const label = 'HARD';

      // Act
      const profile = DifficultyProfileFactory.create(label);

      // Assert
      expect(profile).toBeInstanceOf(HardProfile);
    });

    it('should_be_case_and_whitespace_insensitive_when_matching_the_label', () => {
      // Arrange
      const messyLabel = '  hard  ';

      // Act
      const profile = DifficultyProfileFactory.create(messyLabel);

      // Assert
      expect(profile).toBeInstanceOf(HardProfile);
    });

    it('should_throw_when_the_label_is_unknown', () => {
      // Arrange
      const bogusLabel = 'IMPOSSIBLE';

      // Act & Assert
      expect(() => DifficultyProfileFactory.create(bogusLabel)).toThrow();
    });
  });
});