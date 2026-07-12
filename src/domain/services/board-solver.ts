import { ArrowPathInfo } from '../models/arrow-path-info';
import { BoardLayout } from '../models/board-layout';
/**
 * BoardSolver — decides whether a board is winnable in principle.
 *
 * An arrow is CLEARABLE when its head can fire a ray in `direction`
 * all the way to the grid's edge with no wall and no foreign arrow
 * segment in the ray's path. Once cleared, the arrow's cells free up
 * for other arrows to become clearable. A board is SOLVABLE iff
 * there exists SOME ordering of removals that empties every arrow.
 *
 * Algorithm — greedy, iterative:
 *   repeat:
 *     find any remaining arrow whose head-to-edge ray is clear
 *       (walls and OTHER arrows can block; the arrow's own segments
 *       do not block its own head).
 *     if none exists → stop.
 *     otherwise remove it, freeing its cells.
 *   solvable iff the loop emptied every arrow.
 *
 * Why greedy is enough — monotonicity argument:
 *   Removing an arrow only ADDS freed cells to the board; it never
 *   introduces new obstacles. So if arrow X is clearable now, it is
 *   still clearable after any other arrow is removed. That means the
 *   set of eventually-clearable arrows is invariant under removal
 *   order — any order that removes them all works, and if greedy
 *   stalls with a non-empty board, no order could have finished it
 *   either. Termination is trivial because each successful pass
 *   strictly shrinks the remaining set.
 *
 * Complexity: O(A² × R) worst case, where A is the number of arrows
 *   and R is the longest ray (≤ max(rows, cols)). For the ~10×10
 *   boards this project deals with, negligible.
 *
 * Use: admin upsert (Fase 6) calls isSolvable before persisting a
 *   level so unwinnable layouts are rejected at 400 rather than
 *   discovered by players.
 */
export class BoardSolver {

  private static readonly DIRECTIONS: {
    [dir: string]: { dr: number; dc: number };
  } = {
    UP: { dr: -1, dc: 0 },
    DOWN: { dr: 1, dc: 0 },
    LEFT: { dr: 0, dc: -1 },
    RIGHT: { dr: 0, dc: 1 },
  };
  isSolvable(layout: BoardLayout): boolean {
    const arrowsById = new Map<string, ArrowPathInfo>(
      layout.arrows.map((a) => [a.id, a]),
    );
    const remaining = new Set<string>(arrowsById.keys());
    const walls = new Set<string>(layout.walls);
    const { rows, cols } = layout;
    let progressed = true;
    while (progressed && remaining.size > 0) {
      progressed = false;
      for (const id of remaining) {
        const arrow = arrowsById.get(id)!;
        if (this.canClear(arrow, remaining, arrowsById, walls, rows, cols)) {
          remaining.delete(id);
          progressed = true;
          break;
        }
      }
    }
    return remaining.size === 0;
  }
  private canClear(
    arrow: ArrowPathInfo,
    remaining: Set<string>,
    arrowsById: Map<string, ArrowPathInfo>,
    walls: Set<string>,
    rows: number,
    cols: number,
  ): boolean {
    const [headRow, headCol] = arrow.head
      .split(',')
      .map((s) => parseInt(s, 10));
    const delta = BoardSolver.DIRECTIONS[arrow.direction];
    // Collect all cells currently occupied by OTHER remaining arrows.
    // The arrow's own segments never block its own head — a snake
    // does not run over its own tail.
    const otherArrowCells = new Set<string>();
    for (const otherId of remaining) {
      if (otherId === arrow.id) continue;
      const other = arrowsById.get(otherId)!;
      for (const c of other.cells) otherArrowCells.add(c);
    }
    // Trace the ray from head → edge (exclusive of head itself).
    let r = headRow + delta.dr;
    let c = headCol + delta.dc;
    while (r >= 0 && r < rows && c >= 0 && c < cols) {
      const cell = `${r},${c}`;
      if (walls.has(cell) || otherArrowCells.has(cell)) {
        return false;
      }
      r += delta.dr;
      c += delta.dc;
    }
    return true;
  }
}