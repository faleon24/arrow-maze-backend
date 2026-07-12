import { ArrowPathInfo } from '../../../src/domain/models/arrow-path-info';
describe('ArrowPathInfo', () => {
  describe('construction', () => {
    it('should_build_a_single_cell_arrow_when_cells_has_one_entry', () => {
      // Arrange & Act
      const arrow = new ArrowPathInfo('a1', 'PINK', ['4,3'], 'UP');
      // Assert
      expect(arrow.id).toBe('a1');
      expect(arrow.color).toBe('PINK');
      expect(arrow.cells).toEqual(['4,3']);
      expect(arrow.direction).toBe('UP');
      expect(arrow.head).toBe('4,3');
    });
    it('should_build_a_multi_cell_arrow_when_cells_are_orthogonally_contiguous', () => {
      // Arrange & Act
      const arrow = new ArrowPathInfo(
        'a2',
        'GREEN',
        ['4,2', '4,3', '3,3'],
        'UP',
      );
      // Assert
      expect(arrow.cells).toEqual(['4,2', '4,3', '3,3']);
      expect(arrow.head).toBe('3,3');
    });
    it('should_normalize_case_when_color_and_direction_are_lowercase', () => {
      // Arrange & Act
      const arrow = new ArrowPathInfo('a3', 'pink', ['0,0'], 'up');
      // Assert
      expect(arrow.color).toBe('PINK');
      expect(arrow.direction).toBe('UP');
    });
    it('should_trim_the_id_when_it_carries_surrounding_whitespace', () => {
      // Arrange & Act
      const arrow = new ArrowPathInfo('  a4  ', 'BLUE', ['0,0'], 'DOWN');
      // Assert
      expect(arrow.id).toBe('a4');
    });
  });
  describe('validation', () => {
    it('should_throw_when_id_is_empty', () => {
      // Arrange, Act, Assert
      expect(
        () => new ArrowPathInfo('', 'PINK', ['0,0'], 'UP'),
      ).toThrow(/id/);
    });
    it('should_throw_when_id_is_whitespace_only', () => {
      expect(
        () => new ArrowPathInfo('   ', 'PINK', ['0,0'], 'UP'),
      ).toThrow(/id/);
    });
    it('should_throw_when_color_is_not_in_the_whitelist', () => {
      expect(
        () => new ArrowPathInfo('a1', 'ORANGE', ['0,0'], 'UP'),
      ).toThrow(/Unknown arrow color/);
    });
    it('should_throw_when_direction_is_not_in_the_whitelist', () => {
      expect(
        () => new ArrowPathInfo('a1', 'PINK', ['0,0'], 'NORTH'),
      ).toThrow(/Unknown arrow direction/);
    });
    it('should_throw_when_cells_is_empty', () => {
      expect(
        () => new ArrowPathInfo('a1', 'PINK', [], 'UP'),
      ).toThrow(/non-empty/);
    });
    it('should_throw_when_a_cell_has_a_negative_coordinate', () => {
      expect(
        () => new ArrowPathInfo('a1', 'PINK', ['1,-1'], 'UP'),
      ).toThrow(/row,col/);
    });
    it('should_throw_when_a_cell_carries_whitespace', () => {
      expect(
        () => new ArrowPathInfo('a1', 'PINK', [' 1,1'], 'UP'),
      ).toThrow(/row,col/);
    });
    it('should_throw_when_a_cell_is_not_numeric', () => {
      expect(
        () => new ArrowPathInfo('a1', 'PINK', ['abc'], 'UP'),
      ).toThrow(/row,col/);
    });
    it('should_throw_when_a_cell_is_the_empty_string', () => {
      // Guards the Number('') === 0 quirk — an empty coordinate must
      // NOT silently succeed as (0,0).
      expect(
        () => new ArrowPathInfo('a1', 'PINK', [''], 'UP'),
      ).toThrow(/row,col/);
    });
    it('should_throw_when_consecutive_cells_are_diagonal', () => {
      expect(
        () => new ArrowPathInfo('a1', 'PINK', ['0,0', '1,1'], 'UP'),
      ).toThrow(/orthogonally contiguous/);
    });
    it('should_throw_when_consecutive_cells_jump_more_than_one_step', () => {
      expect(
        () => new ArrowPathInfo('a1', 'PINK', ['0,0', '0,2'], 'UP'),
      ).toThrow(/orthogonally contiguous/);
    });
    it('should_throw_when_a_cell_repeats_inside_the_path', () => {
      // 0,0 → 0,1 → 0,0 is contiguous step-by-step but the path
      // crosses itself, which is not a valid arrow.
      expect(
        () =>
          new ArrowPathInfo('a1', 'PINK', ['0,0', '0,1', '0,0'], 'UP'),
      ).toThrow(/must not repeat/);
    });
  });
  describe('immutability', () => {
    it('should_freeze_the_cells_array_so_external_mutation_is_impossible', () => {
      // Arrange
      const arrow = new ArrowPathInfo('a1', 'PINK', ['0,0', '0,1'], 'UP');
      // Act & Assert
      expect(() => (arrow.cells as string[]).push('0,2')).toThrow();
    });
    it('should_defensively_copy_cells_so_input_mutation_does_not_leak', () => {
      // Arrange
      const input = ['0,0', '0,1'];
      const arrow = new ArrowPathInfo('a1', 'PINK', input, 'UP');
      // Act
      input.push('0,2');
      // Assert
      expect(arrow.cells).toEqual(['0,0', '0,1']);
    });
  });
  describe('toJSON', () => {
    it('should_return_a_plain_v2_snapshot_when_serialized', () => {
      // Arrange
      const arrow = new ArrowPathInfo(
        'a1',
        'PINK',
        ['4,2', '4,3'],
        'UP',
      );
      // Act
      const json = arrow.toJSON();
      // Assert
      expect(json).toEqual({
        id: 'a1',
        color: 'PINK',
        cells: ['4,2', '4,3'],
        direction: 'UP',
      });
    });
    it('should_return_a_defensive_copy_of_cells_when_serialized', () => {
      // Arrange
      const arrow = new ArrowPathInfo('a1', 'PINK', ['0,0'], 'UP');
      // Act
      const json = arrow.toJSON();
      json.cells.push('9,9');
      // Assert — the internal state stays clean.
      expect(arrow.cells).toEqual(['0,0']);
    });
  });
});