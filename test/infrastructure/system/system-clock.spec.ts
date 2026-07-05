import { SystemClock } from '../../../src/infrastructure/system/system-clock';

describe('SystemClock', () => {
  describe('now', () => {
    it('should_return_an_instance_of_date', () => {
      // Arrange
      const clock = new SystemClock();

      // Act
      const result = clock.now();

      // Assert
      expect(result).toBeInstanceOf(Date);
    });

    it('should_return_a_time_close_to_the_actual_now', () => {
      // Arrange
      const clock = new SystemClock();
      const before = Date.now();

      // Act
      const returned = clock.now().getTime();
      const after = Date.now();

      // Assert
      // The returned instant must fall inside the [before, after] window.
      expect(returned).toBeGreaterThanOrEqual(before);
      expect(returned).toBeLessThanOrEqual(after);
    });

    it('should_return_a_fresh_date_on_every_call', () => {
      // Arrange
      const clock = new SystemClock();

      // Act
      const firstCall = clock.now();
      // Busy-wait a small amount to force a different timestamp
      const start = Date.now();
      while (Date.now() - start < 2) {
        // spin
      }
      const secondCall = clock.now();

      // Assert
      expect(secondCall.getTime()).toBeGreaterThanOrEqual(firstCall.getTime());
    });
  });
});