import { CellInfo } from '../../../src/domain/models/cell-info';

describe('CellInfo', () => {
  describe('construction', () => {
    it('should_expose_its_fields_when_constructed_as_empty', () => {
      // Arrange
      const position = '1,2';
      const type = 'EMPTY';

      // Act
      const cell = new CellInfo(position, type);

      // Assert
      expect(cell.position).toBe('1,2');
      expect(cell.type).toBe('EMPTY');
      expect(cell.direction).toBeNull();
    });

    it('should_normalize_type_and_direction_to_uppercase', () => {
      // Arrange
      const cell = new CellInfo('0,0', 'arrow', 'down');

      // Act & Assert
      expect(cell.type).toBe('ARROW');
      expect(cell.direction).toBe('DOWN');
    });

    it('should_throw_when_position_is_empty', () => {
      // Act & Assert
      expect(() => new CellInfo('   ', 'EMPTY')).toThrow();
    });

    it('should_throw_when_type_is_unknown', () => {
      // Act & Assert
      expect(() => new CellInfo('0,0', 'PORTAL')).toThrow();
    });

    it('should_reject_maze_era_cell_types_that_are_no_longer_valid', () => {
      // START, EXIT and WALL belonged to the earlier maze model. The real
      // game is a board of arrows on empty space, so these are no longer
      // accepted cell types.
      expect(() => new CellInfo('0,0', 'START')).toThrow();
      expect(() => new CellInfo('0,0', 'EXIT')).toThrow();
      expect(() => new CellInfo('0,0', 'WALL')).toThrow();
    });
  });

  describe('arrow direction rules', () => {
    it('should_accept_an_arrow_when_it_carries_a_valid_direction', () => {
      // Act
      const cell = new CellInfo('2,3', 'ARROW', 'LEFT');

      // Assert
      expect(cell.type).toBe('ARROW');
      expect(cell.direction).toBe('LEFT');
    });

    it('should_throw_when_an_arrow_has_no_direction', () => {
      // Act & Assert
      expect(() => new CellInfo('2,3', 'ARROW')).toThrow();
    });

    it('should_throw_when_an_arrow_has_an_invalid_direction', () => {
      // Act & Assert
      expect(() => new CellInfo('2,3', 'ARROW', 'SIDEWAYS')).toThrow();
    });

    it('should_throw_when_an_empty_cell_carries_a_direction', () => {
      // Act & Assert
      expect(() => new CellInfo('2,3', 'EMPTY', 'UP')).toThrow();
    });
  });

  describe('toJSON', () => {
    it('should_omit_direction_when_the_cell_is_not_an_arrow', () => {
      // Arrange
      const cell = new CellInfo('0,0', 'EMPTY');

      // Act
      const json = cell.toJSON();

      // Assert
      expect(json).toEqual({ position: '0,0', type: 'EMPTY' });
      expect('direction' in json).toBe(false);
    });

    it('should_include_direction_when_the_cell_is_an_arrow', () => {
      // Arrange
      const cell = new CellInfo('0,0', 'ARROW', 'RIGHT');

      // Act
      const json = cell.toJSON();

      // Assert
      expect(json).toEqual({ position: '0,0', type: 'ARROW', direction: 'RIGHT' });
    });
  });
});