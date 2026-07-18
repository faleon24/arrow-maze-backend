import { Level } from '../../../src/domain/models/level';
import { BoardLayout } from '../../../src/domain/models/board-layout';
import { ArrowPathInfo } from '../../../src/domain/models/arrow-path-info';
import {
  EasyProfile,
  HardProfile,
} from '../../../src/domain/models/difficulty-profile';
describe('Level', () => {
  const buildBoard = () =>
    new BoardLayout({
      rows: 3,
      cols: 3,
      arrows: [new ArrowPathInfo('a1', 'PINK', ['0,0'], 'E')],
    });
  const buildParams = (over: Record<string, unknown> = {}) => ({
    id: 'lvl-1',
    index: 0,
    difficulty: new EasyProfile(),
    board: buildBoard(),
    parTimeMs: 60_000,
    ...over,
  });
  describe('construction', () => {
    it('should_build_a_level_when_all_fields_are_valid', () => {
      // Arrange & Act
      const level = new Level(buildParams());
      // Assert
      expect(level.id).toBe('lvl-1');
      expect(level.index).toBe(0);
      expect(level.parTimeMs).toBe(60_000);
      expect(level.timeLimitMs).toBeNull();
      expect(level.published).toBe(false);
    });
    it('should_default_timeLimitMs_to_null_when_omitted', () => {
      // Arrange & Act
      const level = new Level(buildParams());
      // Assert
      expect(level.timeLimitMs).toBeNull();
    });
    it('should_accept_a_positive_integer_timeLimitMs', () => {
      // Arrange & Act
      const level = new Level(buildParams({ timeLimitMs: 120_000 }));
      // Assert
      expect(level.timeLimitMs).toBe(120_000);
    });
    it('should_accept_null_timeLimitMs_explicitly', () => {
      // Arrange & Act
      const level = new Level(buildParams({ timeLimitMs: null }));
      // Assert
      expect(level.timeLimitMs).toBeNull();
    });
  });
  describe('validation', () => {
    it('should_throw_when_id_is_empty', () => {
      expect(() => new Level(buildParams({ id: '' }))).toThrow(/id/);
    });
    it('should_throw_when_index_is_negative', () => {
      expect(() => new Level(buildParams({ index: -1 }))).toThrow(/index/);
    });
    it('should_throw_when_parTimeMs_is_zero', () => {
      expect(() => new Level(buildParams({ parTimeMs: 0 }))).toThrow(
        /parTimeMs/,
      );
    });
    it('should_throw_when_timeLimitMs_is_zero', () => {
      expect(() => new Level(buildParams({ timeLimitMs: 0 }))).toThrow(
        /timeLimitMs/,
      );
    });
    it('should_throw_when_timeLimitMs_is_not_an_integer', () => {
      expect(() => new Level(buildParams({ timeLimitMs: 1.5 }))).toThrow(
        /timeLimitMs/,
      );
    });
    it('should_throw_when_timeLimitMs_is_negative', () => {
      expect(() => new Level(buildParams({ timeLimitMs: -1 }))).toThrow(
        /timeLimitMs/,
      );
    });
  });
  describe('effectiveParTimeMs', () => {
    it('should_apply_the_easy_multiplier_when_difficulty_is_easy', () => {
      // Arrange
      const level = new Level(
        buildParams({
          difficulty: new EasyProfile(),
          parTimeMs: 100_000,
        }),
      );
      // Assert
      expect(level.effectiveParTimeMs()).toBe(
        Math.round(100_000 * new EasyProfile().parTimeMultiplier()),
      );
    });
    it('should_apply_the_hard_multiplier_when_difficulty_is_hard', () => {
      // Arrange
      const level = new Level(
        buildParams({
          difficulty: new HardProfile(),
          parTimeMs: 100_000,
        }),
      );
      // Assert
      expect(level.effectiveParTimeMs()).toBe(
        Math.round(100_000 * new HardProfile().parTimeMultiplier()),
      );
    });
  });
  describe('publish/retire', () => {
    it('should_start_unpublished_when_flag_is_omitted', () => {
      expect(new Level(buildParams()).published).toBe(false);
    });
    it('should_become_published_after_publish_is_called', () => {
      const level = new Level(buildParams());
      level.publish();
      expect(level.published).toBe(true);
    });
    it('should_return_to_unpublished_after_retire_is_called', () => {
      const level = new Level(buildParams({ published: true }));
      level.retire();
      expect(level.published).toBe(false);
    });
  });
});
