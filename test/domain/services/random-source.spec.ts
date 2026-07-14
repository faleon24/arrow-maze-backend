import {
  DefaultRandomSource,
  SeededRandomSource,
} from '../../../src/domain/services/random-source';

describe('SeededRandomSource', () => {
  describe('nextInt', () => {
    it('should_produce_the_same_sequence_when_two_instances_share_a_seed', () => {
      // Arrange
      const a = new SeededRandomSource(42);
      const b = new SeededRandomSource(42);

      // Act & Assert
      for (let i = 0; i < 20; i++) {
        expect(a.nextInt(100)).toBe(b.nextInt(100));
      }
    });

    it('should_produce_values_within_the_requested_half_open_range', () => {
      // Arrange
      const rng = new SeededRandomSource(7);

      // Act & Assert
      for (let i = 0; i < 200; i++) {
        const v = rng.nextInt(10);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(10);
      }
    });

    it('should_throw_when_max_is_not_a_positive_integer', () => {
      // Arrange
      const rng = new SeededRandomSource(1);

      // Act & Assert
      expect(() => rng.nextInt(0)).toThrow(/positive integer/);
      expect(() => rng.nextInt(-1)).toThrow(/positive integer/);
      expect(() => rng.nextInt(1.5)).toThrow(/positive integer/);
    });

    it('should_throw_when_seed_is_not_an_integer', () => {
      expect(() => new SeededRandomSource(1.5)).toThrow(/integer/);
    });
  });
});

describe('DefaultRandomSource', () => {
  describe('nextInt', () => {
    it('should_produce_values_within_the_requested_half_open_range', () => {
      // Arrange
      const rng = new DefaultRandomSource();

      // Act & Assert
      for (let i = 0; i < 200; i++) {
        const v = rng.nextInt(50);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(50);
      }
    });

    it('should_throw_when_max_is_not_a_positive_integer', () => {
      const rng = new DefaultRandomSource();
      expect(() => rng.nextInt(0)).toThrow(/positive integer/);
    });
  });
});
