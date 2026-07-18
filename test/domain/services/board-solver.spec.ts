import { ArrowPathInfo } from '../../../src/domain/models/arrow-path-info';
import { BoardLayout } from '../../../src/domain/models/board-layout';
import { BoardSolver } from '../../../src/domain/services/board-solver';
describe('BoardSolver', () => {
  const solver = new BoardSolver();
  it('should_return_true_when_a_single_arrow_has_a_clear_ray', () => {
    // Arrange
    const layout = new BoardLayout({
      rows: 3,
      cols: 3,
      arrows: [new ArrowPathInfo('a1', 'PINK', ['1,1'], 'NE')],
    });
    // Assert
    expect(solver.isSolvable(layout)).toBe(true);
  });
  it('should_return_true_when_arrows_can_be_cleared_in_the_right_order', () => {
    // Arrange: a2 sits above a1, both firing NW. a1 is blocked by a2
    // initially (NW from odd row 3 lands on 2,0); removing a2 (whose
    // ray leaves the grid immediately) frees a1.
    const layout = new BoardLayout({
      rows: 4,
      cols: 3,
      arrows: [
        new ArrowPathInfo('a1', 'PINK', ['3,0'], 'NW'),
        new ArrowPathInfo('a2', 'BLUE', ['2,0'], 'NW'),
      ],
    });
    // Assert
    expect(solver.isSolvable(layout)).toBe(true);
  });
  it('should_return_false_when_two_arrows_deadlock_each_other', () => {
    // Arrange: a1 fires E, a2 to its right fires W. Both
    // rays hit each other. Neither can go first — deadlock.
    const layout = new BoardLayout({
      rows: 1,
      cols: 4,
      arrows: [
        new ArrowPathInfo('a1', 'PINK', ['0,0'], 'E'),
        new ArrowPathInfo('a2', 'BLUE', ['0,3'], 'W'),
      ],
    });
    // Assert
    expect(solver.isSolvable(layout)).toBe(false);
  });
  it('should_return_false_when_a_wall_blocks_the_only_ray', () => {
    // Arrange — NE from even row 2 lands on 1,1, where the wall sits.
    const layout = new BoardLayout({
      rows: 3,
      cols: 3,
      arrows: [new ArrowPathInfo('a1', 'PINK', ['2,1'], 'NE')],
      walls: ['1,1'],
    });
    // Assert
    expect(solver.isSolvable(layout)).toBe(false);
  });
  it('should_treat_a_single_cell_arrow_as_the_degenerate_case_of_a_path', () => {
    // Arrange — head equals tail for a 1-cell arrow; guards
    // against an off-by-one where the head cell would block itself.
    const layout = new BoardLayout({
      rows: 2,
      cols: 2,
      arrows: [new ArrowPathInfo('a1', 'PINK', ['0,0'], 'E')],
    });
    // Assert
    expect(solver.isSolvable(layout)).toBe(true);
  });
  it('should_return_true_when_a_multi_cell_arrow_has_a_clear_ray_from_its_head', () => {
    // Arrange — snake path 3,0 → 3,1 → 2,1, head at 2,1 firing NW.
    // The arrow's own tail (3,0 / 3,1) is behind the head and does
    // not block; the ray from the head is empty. Solvable.
    const layout = new BoardLayout({
      rows: 4,
      cols: 3,
      arrows: [
        new ArrowPathInfo('a1', 'PINK', ['3,0', '3,1', '2,1'], 'NW'),
      ],
    });
    // Assert
    expect(solver.isSolvable(layout)).toBe(true);
  });
});
