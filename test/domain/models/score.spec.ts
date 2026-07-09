import { Score } from '../../../src/domain/models/score';

/**
 * Factory for a valid Score, overridable per-field so each test
 * states only the dimension it cares about.
 */
function buildScore(
  overrides: Partial<{ moves: number; timeMs: number; stars: number }> = {},
): Score {
  const { moves = 10, timeMs = 60_000, stars = 2 } = overrides;
  return new Score(moves, timeMs, stars);
}

describe('Score', () => {
  describe('construction', () => {
    it('should_expose_its_components_when_constructed_with_valid_values', () => {
      // Arrange
      const moves = 12;
      const timeMs = 45_000;
      const stars = 3;

      // Act
      const score = new Score(moves, timeMs, stars);

      // Assert
      expect(score.moves).toBe(moves);
      expect(score.timeMs).toBe(timeMs);
      expect(score.stars).toBe(stars);
    });

    it('should_throw_when_moves_is_negative', () => {
      // Arrange
      const negativeMoves = -1;

      // Act & Assert
      expect(() => buildScore({ moves: negativeMoves })).toThrow();
    });

    it('should_throw_when_timeMs_is_not_an_integer', () => {
      // Arrange
      const fractionalTime = 100.5;

      // Act & Assert
      expect(() => buildScore({ timeMs: fractionalTime })).toThrow();
    });

    it('should_throw_when_stars_exceed_the_maximum', () => {
      // Arrange
      const tooManyStars = 4;

      // Act & Assert
      expect(() => buildScore({ stars: tooManyStars })).toThrow();
    });
  });

  describe('compareTo', () => {
    it('should_rank_higher_star_score_ahead_when_stars_differ', () => {
      // Arrange
      const threeStars = buildScore({ stars: 3 });
      const twoStars = buildScore({ stars: 2 });

      // Act
      const result = threeStars.compareTo(twoStars);

      // Assert
      expect(result).toBeLessThan(0);
    });

    it('should_rank_fewer_moves_ahead_when_stars_tie', () => {
      // Arrange
      const fewerMoves = buildScore({ stars: 3, moves: 8 });
      const moreMoves = buildScore({ stars: 3, moves: 20 });

      // Act
      const result = fewerMoves.compareTo(moreMoves);

      // Assert
      expect(result).toBeLessThan(0);
    });

    it('should_rank_faster_time_ahead_when_stars_and_moves_tie', () => {
      // Arrange
      const faster = buildScore({ stars: 3, moves: 10, timeMs: 30_000 });
      const slower = buildScore({ stars: 3, moves: 10, timeMs: 90_000 });

      // Act
      const result = faster.compareTo(slower);

      // Assert
      expect(result).toBeLessThan(0);
    });

    it('should_return_zero_when_all_components_tie', () => {
      // Arrange
      const a = buildScore({ stars: 2, moves: 10, timeMs: 60_000 });
      const b = buildScore({ stars: 2, moves: 10, timeMs: 60_000 });

      // Act
      const result = a.compareTo(b);

      // Assert
      expect(result).toBe(0);
    });
  });

  describe('equals', () => {
    it('should_be_equal_when_all_components_match', () => {
      // Arrange
      const a = buildScore({ stars: 2, moves: 10, timeMs: 60_000 });
      const b = buildScore({ stars: 2, moves: 10, timeMs: 60_000 });

      // Act & Assert
      expect(a.equals(b)).toBe(true);
    });

    it('should_not_be_equal_when_a_component_differs', () => {
      // Arrange
      const a = buildScore({ moves: 10 });
      const b = buildScore({ moves: 11 });

      // Act & Assert
      expect(a.equals(b)).toBe(false);
    });
  });
});