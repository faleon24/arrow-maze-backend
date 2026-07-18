import { ArrowPathInfo } from '../models/arrow-path-info';
import { BoardLayout } from '../models/board-layout';
import { hexStep } from '../models/hex';

export class BoardSolver {
  isSolvable(layout: BoardLayout): boolean {
    const arrowsById = new Map(layout.arrows.map((a) => [a.id, a]));
    const remaining = new Set(arrowsById.keys());
    const walls = new Set(layout.walls);
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
    const [headRow, headCol] = arrow.head.split(',').map((s) => parseInt(s, 10));

    const otherArrowCells = new Set<string>();
    for (const otherId of remaining) {
      if (otherId === arrow.id) continue;
      for (const c of arrowsById.get(otherId)!.cells) otherArrowCells.add(c);
    }

    // Ray-trace HEX paso a paso: el delta cambia por paridad de fila,
    // asi que en cada iteracion recalculamos el vecino con hexStep.
    let { row: r, col: c } = hexStep(arrow.direction, headRow, headCol);
    while (r >= 0 && r < rows && c >= 0 && c < cols) {
      const cell = `${r},${c}`;
      if (walls.has(cell) || otherArrowCells.has(cell)) return false;
      ({ row: r, col: c } = hexStep(arrow.direction, r, c));
    }

    return true;
  }
}
