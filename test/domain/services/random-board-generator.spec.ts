import { BoardSolver } from '../../../src/domain/services/board-solver';
import { RandomBoardGenerator } from '../../../src/domain/services/random-board-generator';
import { SeededRandomSource } from '../../../src/domain/services/random-source';
import { hexStep, hexDirectionBetween } from '../../../src/domain/models/hex';

describe('RandomBoardGenerator', () => {
  const solver = new BoardSolver();

  describe('generate', () => {
    it('should_produce_a_solvable_board_when_difficulty_is_easy', () => {
      const gen = new RandomBoardGenerator(solver, new SeededRandomSource(42));
      const layout = gen.generate('EASY');
      expect(solver.isSolvable(layout)).toBe(true);
      expect(layout.arrows.length).toBeGreaterThanOrEqual(3);
    });

    it('should_produce_a_solvable_board_when_difficulty_is_medium', () => {
      const gen = new RandomBoardGenerator(solver, new SeededRandomSource(123));
      const layout = gen.generate('MEDIUM');
      expect(solver.isSolvable(layout)).toBe(true);
      expect(layout.arrows.length).toBeGreaterThanOrEqual(5);
    });

    it('should_produce_a_solvable_board_when_difficulty_is_hard', () => {
      const gen = new RandomBoardGenerator(solver, new SeededRandomSource(7));
      const layout = gen.generate('HARD');
      expect(solver.isSolvable(layout)).toBe(true);
      expect(layout.arrows.length).toBeGreaterThanOrEqual(8);
    });

    it('should_produce_reproducible_output_when_same_seed_is_used_twice', () => {
      const g1 = new RandomBoardGenerator(solver, new SeededRandomSource(999));
      const g2 = new RandomBoardGenerator(solver, new SeededRandomSource(999));
      const b1 = g1.generate('MEDIUM');
      const b2 = g2.generate('MEDIUM');
      expect(b1.rows).toBe(b2.rows);
      expect(b1.cols).toBe(b2.cols);
      expect(b1.arrows.length).toBe(b2.arrows.length);
      for (let i = 0; i < b1.arrows.length; i++) {
        expect(b1.arrows[i].cells).toEqual(b2.arrows[i].cells);
        expect(b1.arrows[i].direction).toBe(b2.arrows[i].direction);
      }
    });

    it('should_accept_lowercase_difficulty_labels_when_normalizing', () => {
      const gen = new RandomBoardGenerator(solver, new SeededRandomSource(50));
      expect(() => gen.generate('easy')).not.toThrow();
    });

    it('should_throw_when_difficulty_is_not_in_the_whitelist', () => {
      const gen = new RandomBoardGenerator(solver, new SeededRandomSource(1));
      expect(() => gen.generate('LEGENDARY')).toThrow(/unknown difficulty/i);
    });

    it('should_produce_arrows_whose_cells_fit_inside_the_grid', () => {
      const gen = new RandomBoardGenerator(solver, new SeededRandomSource(50));
      const layout = gen.generate('MEDIUM');
      for (const arrow of layout.arrows) {
        for (const cell of arrow.cells) {
          const [r, c] = cell.split(',').map((s) => parseInt(s, 10));
          expect(r).toBeGreaterThanOrEqual(0);
          expect(r).toBeLessThan(layout.rows);
          expect(c).toBeGreaterThanOrEqual(0);
          expect(c).toBeLessThan(layout.cols);
        }
      }
    });

    it('should_produce_arrows_with_unique_ids_across_the_board', () => {
      const gen = new RandomBoardGenerator(solver, new SeededRandomSource(11));
      const layout = gen.generate('HARD');
      const ids = layout.arrows.map((a) => a.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('should_scale_median_arrow_count_with_difficulty', () => {
      const easyGen = new RandomBoardGenerator(
        solver,
        new SeededRandomSource(1),
      );
      const hardGen = new RandomBoardGenerator(
        solver,
        new SeededRandomSource(1),
      );
      let easySum = 0;
      let hardSum = 0;
      for (let i = 0; i < 5; i++) {
        easySum += easyGen.generate('EASY').arrows.length;
        hardSum += hardGen.generate('HARD').arrows.length;
      }
      expect(hardSum).toBeGreaterThan(easySum);
    });

    it('should_produce_at_least_one_multi_cell_arrow_when_difficulty_is_hard', () => {
      // Arrange — sample 3 hard boards; at least one arrow across
      // them should be multi-cell given the arrowLength distribution.
      const gen = new RandomBoardGenerator(solver, new SeededRandomSource(33));

      // Act
      let sawMultiCell = false;
      for (let i = 0; i < 3; i++) {
        const layout = gen.generate('HARD');
        if (layout.arrows.some((a) => a.cells.length >= 2)) {
          sawMultiCell = true;
          break;
        }
      }

      // Assert
      expect(sawMultiCell).toBe(true);
    });

    it('should_align_head_direction_with_last_segment_of_multi_cell_arrow', () => {
      // Arrange
      const gen = new RandomBoardGenerator(solver, new SeededRandomSource(77));

      // Act — sample HARD boards and check every multi-cell arrow.
      const layout = gen.generate('HARD');
      const multi = layout.arrows.filter((a) => a.cells.length >= 2);

      // Assert — at least one multi-cell arrow exists in a HARD board
      // and its direction matches the hex step of the last segment.
      expect(multi.length).toBeGreaterThan(0);
      for (const arrow of multi) {
        const [pr, pc] = arrow.cells[arrow.cells.length - 2]
          .split(',')
          .map((s) => parseInt(s, 10));
        const [hr, hc] = arrow.head.split(',').map((s) => parseInt(s, 10));
        const expected = hexDirectionBetween(
          { row: pr, col: pc },
          { row: hr, col: hc },
        );
        expect(arrow.direction).toBe(expected);
      }
    });

    it('should_produce_hard_board_with_low_initial_activatable_ratio', () => {
      // Arrange — a HARD board should have at most 40% of arrows
      // activatable initially (rest are blocked, forcing planning).
      const gen = new RandomBoardGenerator(solver, new SeededRandomSource(7));

      // Act
      const layout = gen.generate('HARD');

      // Assert — recount activatable using the same walk semantics.
      const activatable = countActivatable(layout);
      const ratio = activatable / layout.arrows.length;
      expect(ratio).toBeLessThanOrEqual(0.4);
    });
  });
});

function countActivatable(layout: {
  rows: number;
  cols: number;
  arrows: readonly {
    id: string;
    cells: readonly string[];
    direction: string;
    head: string;
  }[];
  walls: readonly string[];
}): number {
  let count = 0;
  for (const arrow of layout.arrows) {
    const others = new Set<string>();
    for (const a of layout.arrows) {
      if (a.id === arrow.id) continue;
      for (const c of a.cells) others.add(c);
    }
    const walls = new Set(layout.walls);
    const [hr, hc] = arrow.head.split(',').map((s) => parseInt(s, 10));
    let { row: r, col: c } = hexStep(arrow.direction, hr, hc);
    let clear = true;
    while (r >= 0 && r < layout.rows && c >= 0 && c < layout.cols) {
      const cell = `${r},${c}`;
      if (walls.has(cell) || others.has(cell)) {
        clear = false;
        break;
      }
      ({ row: r, col: c } = hexStep(arrow.direction, r, c));
    }
    if (clear) count++;
  }
  return count;
}
