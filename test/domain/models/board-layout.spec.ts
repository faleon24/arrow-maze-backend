import { BoardLayout } from '../../../src/domain/models/board-layout';
import { CellInfo } from '../../../src/domain/models/cell-info';

/**
 * Builds a minimal valid set of cells for a grid: one START at 0,0 and
 * one EXIT at the far corner. Extra cells can be appended by the caller.
 */
function minimalCells(rows: number, cols: number): CellInfo[] {
  return [
    new CellInfo('0,0', 'START'),
    new CellInfo(`${rows - 1},${cols - 1}`, 'EXIT'),
  ];
}

describe('BoardLayout', () => {
  describe('construction', () => {
    it('should_expose_dimensions_and_cells_when_valid', () => {
      // Arrange
      const cells = minimalCells(3, 3);

      // Act
      const board = new BoardLayout(3, 3, cells);

      // Assert
      expect(board.rows).toBe(3);
      expect(board.cols).toBe(3);
      expect(board.cells).toHaveLength(2);
    });

    it('should_throw_when_rows_is_not_positive', () => {
      // Act & Assert
      expect(() => new BoardLayout(0, 3, minimalCells(3, 3))).toThrow();
    });

    it('should_throw_when_cols_is_not_an_integer', () => {
      // Act & Assert
      expect(() => new BoardLayout(3, 2.5, minimalCells(3, 3))).toThrow();
    });
  });

  describe('board invariants', () => {
    it('should_throw_when_there_is_no_start_cell', () => {
      // Arrange
      const cells = [new CellInfo('2,2', 'EXIT')];

      // Act & Assert
      expect(() => new BoardLayout(3, 3, cells)).toThrow();
    });

    it('should_throw_when_there_is_more_than_one_start_cell', () => {
      // Arrange
      const cells = [
        new CellInfo('0,0', 'START'),
        new CellInfo('0,1', 'START'),
        new CellInfo('2,2', 'EXIT'),
      ];

      // Act & Assert
      expect(() => new BoardLayout(3, 3, cells)).toThrow();
    });

    it('should_throw_when_there_is_no_exit_cell', () => {
      // Arrange
      const cells = [new CellInfo('0,0', 'START')];

      // Act & Assert
      expect(() => new BoardLayout(3, 3, cells)).toThrow();
    });

    it('should_throw_when_two_cells_share_a_position', () => {
      // Arrange
      const cells = [
        new CellInfo('0,0', 'START'),
        new CellInfo('0,0', 'EXIT'),
      ];

      // Act & Assert
      expect(() => new BoardLayout(3, 3, cells)).toThrow();
    });

    it('should_throw_when_a_cell_falls_outside_the_grid', () => {
      // Arrange
      const cells = [
        new CellInfo('0,0', 'START'),
        new CellInfo('9,9', 'EXIT'),
      ];

      // Act & Assert
      expect(() => new BoardLayout(3, 3, cells)).toThrow();
    });
  });

  describe('immutability', () => {
    it('should_not_reflect_later_mutations_of_the_input_array', () => {
      // Arrange
      const cells = minimalCells(3, 3);
      const board = new BoardLayout(3, 3, cells);

      // Act
      cells.push(new CellInfo('1,1', 'WALL'));

      // Assert
      expect(board.cells).toHaveLength(2);
    });
  });

  describe('toJSON', () => {
    it('should_serialize_dimensions_and_every_cell', () => {
      // Arrange
      const board = new BoardLayout(2, 2, [
        new CellInfo('0,0', 'START'),
        new CellInfo('1,1', 'EXIT'),
      ]);

      // Act
      const json = board.toJSON();

      // Assert
      expect(json.rows).toBe(2);
      expect(json.cols).toBe(2);
      expect(json.cells).toHaveLength(2);
    });
  });
});