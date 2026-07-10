import { Level } from '../../../src/domain/models/level';
import { BoardLayout } from '../../../src/domain/models/board-layout';
import { CellInfo } from '../../../src/domain/models/cell-info';
import {
  DifficultyProfile,
  EasyProfile,
  HardProfile,
} from '../../../src/domain/models/difficulty-profile';

function buildBoard(): BoardLayout {
  return new BoardLayout(3, 3, [
    new CellInfo('0,0', 'ARROW', 'RIGHT'),
    new CellInfo('2,2', 'ARROW', 'LEFT'),
  ]);
}

function buildLevel(
  overrides: Partial<{
    id: string;
    index: number;
    difficulty: DifficultyProfile;
    board: BoardLayout;
    parTimeMs: number;
    published: boolean;
  }> = {},
): Level {
  return new Level({
    id: overrides.id ?? 'level-1',
    index: overrides.index ?? 0,
    difficulty: overrides.difficulty ?? new EasyProfile(),
    board: overrides.board ?? buildBoard(),
    parTimeMs: overrides.parTimeMs ?? 100_000,
    published: overrides.published,
  });
}

describe('Level', () => {
  describe('construction', () => {
    it('should_expose_its_fields_when_constructed_validly', () => {
      // Arrange
      const board = buildBoard();

      // Act
      const level = buildLevel({ id: 'abc', index: 4, board });

      // Assert
      expect(level.id).toBe('abc');
      expect(level.index).toBe(4);
      expect(level.board).toBe(board);
      expect(level.difficulty).toBeInstanceOf(EasyProfile);
    });

    it('should_default_to_unpublished_when_not_specified', () => {
      // Act
      const level = buildLevel();

      // Assert
      expect(level.published).toBe(false);
    });

    it('should_throw_when_id_is_empty', () => {
      // Act & Assert
      expect(() => buildLevel({ id: '  ' })).toThrow();
    });

    it('should_throw_when_index_is_negative', () => {
      // Act & Assert
      expect(() => buildLevel({ index: -1 })).toThrow();
    });

    it('should_throw_when_parTimeMs_is_not_positive', () => {
      // Act & Assert
      expect(() => buildLevel({ parTimeMs: 0 })).toThrow();
    });
  });

  describe('effectiveParTimeMs', () => {
    it('should_apply_the_difficulty_multiplier_to_the_base_time', () => {
      // Arrange
      const base = 100_000;
      const easy = buildLevel({ difficulty: new EasyProfile(), parTimeMs: base });

      // Act
      const effective = easy.effectiveParTimeMs();

      // Assert: EasyProfile multiplier is 1.5
      expect(effective).toBe(150_000);
    });

    it('should_be_stricter_on_a_harder_tier_for_the_same_base_time', () => {
      // Arrange
      const base = 100_000;
      const easy = buildLevel({ difficulty: new EasyProfile(), parTimeMs: base });
      const hard = buildLevel({ difficulty: new HardProfile(), parTimeMs: base });

      // Act & Assert
      expect(hard.effectiveParTimeMs()).toBeLessThan(easy.effectiveParTimeMs());
    });
  });

  describe('publication lifecycle', () => {
    it('should_become_published_when_publish_is_called', () => {
      // Arrange
      const level = buildLevel({ published: false });

      // Act
      level.publish();

      // Assert
      expect(level.published).toBe(true);
    });

    it('should_become_unpublished_when_retire_is_called', () => {
      // Arrange
      const level = buildLevel({ published: true });

      // Act
      level.retire();

      // Assert
      expect(level.published).toBe(false);
    });
  });
});