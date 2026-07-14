import { BoardSolver } from '../../../src/domain/services/board-solver';
import { RandomBoardGenerator } from '../../../src/domain/services/random-board-generator';
import { SeededRandomSource } from '../../../src/domain/services/random-source';

describe('RandomBoardGenerator', () => {
  const solver = new BoardSolver();

  describe('generate', () => {
    it('should_produce_a_solvable_board_when_difficulty_is_easy', () => {
      // Arrange
      const gen = new RandomBoardGenerator(solver, new SeededRandomSource(42));

      // Act
      const layout = gen.generate('EASY');

      // Assert
      expect(solver.isSolvable(layout)).toBe(true);
      expect(layout.arrows.length).toBeGreaterThanOrEqual(2);
    });

    it('should_produce_a_solvable_board_when_difficulty_is_medium', () => {
      // Arrange
      const gen = new RandomBoardGenerator(solver, new SeededRandomSource(123));

      // Act
      const layout = gen.generate('MEDIUM');

      // Assert
      expect(solver.isSolvable(layout)).toBe(true);
      expect(layout.arrows.length).toBeGreaterThanOrEqual(3);
    });

    it('should_produce_a_solvable_board_when_difficulty_is_hard', () => {
      // Arrange
      const gen = new RandomBoardGenerator(solver, new SeededRandomSource(7));

      // Act
      const layout = gen.generate('HARD');

      // Assert
      expect(solver.isSolvable(layout)).toBe(true);
      expect(layout.arrows.length).toBeGreaterThanOrEqual(5);
    });

    it('should_produce_reproducible_output_when_same_seed_is_used_twice', () => {
      // Arrange
      const g1 = new RandomBoardGenerator(solver, new SeededRandomSource(999));
      const g2 = new RandomBoardGenerator(solver, new SeededRandomSource(999));

      // Act
      const b1 = g1.generate('MEDIUM');
      const b2 = g2.generate('MEDIUM');

      // Assert
      expect(b1.rows).toBe(b2.rows);
      expect(b1.cols).toBe(b2.cols);
      expect(b1.arrows.length).toBe(b2.arrows.length);
      for (let i = 0; i < b1.arrows.length; i++) {
        expect(b1.arrows[i].cells).toEqual(b2.arrows[i].cells);
        expect(b1.arrows[i].direction).toBe(b2.arrows[i].direction);
      }
    });

    it('should_accept_lowercase_difficulty_labels_when_normalizing', () => {
      // Arrange
      const gen = new RandomBoardGenerator(solver, new SeededRandomSource(50));

      // Act & Assert
      expect(() => gen.generate('easy')).not.toThrow();
    });

    it('should_throw_when_difficulty_is_not_in_the_whitelist', () => {
      // Arrange
      const gen = new RandomBoardGenerator(solver, new SeededRandomSource(1));

      // Act & Assert
      expect(() => gen.generate('LEGENDARY')).toThrow(/unknown difficulty/i);
    });

    it('should_produce_arrows_whose_cells_fit_inside_the_grid', () => {
      // Arrange
      const gen = new RandomBoardGenerator(solver, new SeededRandomSource(50));

      // Act
      const layout = gen.generate('MEDIUM');

      // Assert
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
      // Arrange
      const gen = new RandomBoardGenerator(solver, new SeededRandomSource(11));

      // Act
      const layout = gen.generate('HARD');

      // Assert
      const ids = layout.arrows.map((a) => a.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('should_scale_median_arrow_count_with_difficulty', () => {
      // Arrange — sample ten boards per difficulty to smooth randomness.
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

      // Act
      for (let i = 0; i < 10; i++) {
        easySum += easyGen.generate('EASY').arrows.length;
        hardSum += hardGen.generate('HARD').arrows.length;
      }

      // Assert
      expect(hardSum).toBeGreaterThan(easySum);
    });
  });
});
