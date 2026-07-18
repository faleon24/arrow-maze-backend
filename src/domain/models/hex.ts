export const HEX_DIRECTIONS = ['E', 'W', 'NE', 'NW', 'SE', 'SW'] as const;

export function isHexDirection(d: string): boolean {
  return (HEX_DIRECTIONS as readonly string[]).includes(d);
}

/** One step from (row,col) in `direction`, odd-r offset (parity-aware). */
export function hexStep(direction: string, row: number, col: number): { row: number; col: number } {
  const even = row % 2 === 0;
  switch (direction) {
    case 'E':  return { row, col: col + 1 };
    case 'W':  return { row, col: col - 1 };
    case 'NE': return { row: row - 1, col: even ? col : col + 1 };
    case 'NW': return { row: row - 1, col: even ? col - 1 : col };
    case 'SE': return { row: row + 1, col: even ? col : col + 1 };
    case 'SW': return { row: row + 1, col: even ? col - 1 : col };
    default: throw new Error(`Unknown hex direction: ${JSON.stringify(direction)}`);
  }
}

export function hexNeighbors(row: number, col: number): Array<{ row: number; col: number }> {
  return HEX_DIRECTIONS.map((d) => hexStep(d, row, col));
}

export function areHexAdjacent(a: { row: number; col: number }, b: { row: number; col: number }): boolean {
  return hexNeighbors(a.row, a.col).some((n) => n.row === b.row && n.col === b.col);
}

export function hexDirectionBetween(from: { row: number; col: number }, to: { row: number; col: number }): string | null {
  for (const d of HEX_DIRECTIONS) {
    const n = hexStep(d, from.row, from.col);
    if (n.row === to.row && n.col === to.col) return d;
  }
  return null;
}
