import { LeaderboardEntry } from '../../../src/domain/models/leaderboard-entry';

describe('LeaderboardEntry', () => {
  const validProps = {
    userDisplayName: 'Alice',
    stars: 3,
    timeMs: 45_000,
    completedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  describe('construction', () => {
    it('should_expose_all_fields_when_constructed_with_valid_props', () => {
      const entry = new LeaderboardEntry(validProps);

      expect(entry.userDisplayName).toBe('Alice');
      expect(entry.stars).toBe(3);
      expect(entry.timeMs).toBe(45_000);
      expect(entry.completedAt).toEqual(
        new Date('2026-01-01T00:00:00.000Z'),
      );
    });

    it('should_throw_when_display_name_is_blank', () => {
      expect(
        () =>
          new LeaderboardEntry({ ...validProps, userDisplayName: '   ' }),
      ).toThrow(/non-blank/);
    });

    it('should_throw_when_stars_is_below_zero', () => {
      expect(
        () => new LeaderboardEntry({ ...validProps, stars: -1 }),
      ).toThrow(/stars/);
    });

    it('should_throw_when_stars_is_above_three', () => {
      expect(
        () => new LeaderboardEntry({ ...validProps, stars: 4 }),
      ).toThrow(/stars/);
    });

    it('should_throw_when_time_ms_is_negative', () => {
      expect(
        () => new LeaderboardEntry({ ...validProps, timeMs: -1 }),
      ).toThrow(/timeMs/);
    });
  });

  describe('equals', () => {
    it('should_return_true_when_all_fields_match', () => {
      const a = new LeaderboardEntry(validProps);
      const b = new LeaderboardEntry({ ...validProps });

      expect(a.equals(b)).toBe(true);
    });

    it('should_return_false_when_stars_differ', () => {
      const a = new LeaderboardEntry(validProps);
      const b = new LeaderboardEntry({ ...validProps, stars: 2 });

      expect(a.equals(b)).toBe(false);
    });
  });
});