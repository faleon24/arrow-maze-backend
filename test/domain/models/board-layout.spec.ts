import { BoardLayout } from '../../../src/domain/models/board-layout';
import { CellInfo } from '../../../src/domain/models/cell-info';

/**
 * Builds a minimal valid set of cells for a grid: two arrows, enough to
 * make a non-trivial board. Extra cells can be appended by the caller.
 */
function minimalCells(): CellInfo[] {
  return [
    new CellInfo('0,0', 'ARROW', 'RIGHT'),
    new CellInfo('0,2', 'ARROW', 'RIGHT'),
  ];
}

describe('BoardLayout', () => {
  describe('construction', () => {
    it('should_expose_dimensions_and_cells_when_valid', () => {
      // Arrange
      const cells = minimalCells();

      // Act
      const board = new BoardLayout(1, 3, cells);

      // Assert
      expect(board.rows).toBe(1);
      expect(board.cols).toBe(3);
      expect(board.cells).toHaveLength(2);
    });

    it('should_throw_when_rows_is_not_positive', () => {
      // Act & Assert
      expect(() => new BoardLayout(0, 3, minimalCells())).toThrow();
    });

    it('should_throw_when_cols_is_not_an_integer', () => {
      // Act & Assert
      expect(() => new BoardLayout(1, 2.5, minimalCells())).toThrow();
    });
  });

  describe('board invariants', () => {
    it('should_throw_when_there_are_no_arrows', () => {
      // A board with no arrows would already be solved, so it is invalid.
      // Arrange
      const cells = [new CellInfo('0,0', 'EMPTY')];

      // Act & Assert
      expect(() => new BoardLayout(3, 3, cells)).toThrow();
    });

    it('should_accept_a_board_with_at_least_one_arrow', () => {
      // Arrange
      const cells = [new CellInfo('1,1', 'ARROW', 'UP')];

      // Act
      const board = new BoardLayout(3, 3, cells);

      // Assert
      expect(board.cells).toHaveLength(1);
    });

    it('should_throw_when_two_cells_share_a_position', () => {
      // Arrange
      const cells = [
        new CellInfo('0,0', 'ARROW', 'RIGHT'),
        new CellInfo('0,0', 'ARROW', 'LEFT'),
      ];

      // Act & Assert
      expect(() => new BoardLayout(3, 3, cells)).toThrow();
    });

    it('should_throw_when_a_cell_falls_outside_the_grid', () => {
      // Arrange
      const cells = [
        new CellInfo('0,0', 'ARROW', 'RIGHT'),
        new CellInfo('9,9', 'ARROW', 'LEFT'),
      ];

      // Act & Assert
      expect(() => new BoardLayout(3, 3, cells)).toThrow();
    });
  });

  describe('immutability', () => {
    it('should_not_reflect_later_mutations_of_the_input_array', () => {
      // Arrange
      const cells = minimalCells();
      const board = new BoardLayout(1, 3, cells);

      // Act
      cells.push(new CellInfo('0,1', 'ARROW', 'DOWN'));

      // Assert
      expect(board.cells).toHaveLength(2);
    });
  });

  describe('toJSON', () => {
    it('should_serialize_dimensions_and_every_cell', () => {
      // Arrange
      const board = new BoardLayout(1, 2, [
        new CellInfo('0,0', 'ARROW', 'RIGHT'),
        new CellInfo('0,1', 'ARROW', 'LEFT'),
      ]);

      // Act
      const json = board.toJSON();

      // Assert
      expect(json.rows).toBe(1);
      expect(json.cols).toBe(2);
      expect(json.cells).toHaveLength(2);
    });
  });
});