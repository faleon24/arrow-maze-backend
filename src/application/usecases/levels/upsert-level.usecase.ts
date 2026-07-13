import { ArrowPathInfo } from '../../../domain/models/arrow-path-info';
import { BoardLayout } from '../../../domain/models/board-layout';
import { CollectibleInfo } from '../../../domain/models/collectible-info';
import { DifficultyProfileFactory } from '../../../domain/models/difficulty-profile.factory';
import { Level } from '../../../domain/models/level';
import { BoardSolver } from '../../../domain/services/board-solver';
import { ILevelRepository } from '../../ports/out/level-repository.port';

export interface UpsertLevelCommand {
  id: string;
  index: number;
  difficulty: string;
  parTimeMs: number;
  timeLimitMs?: number | null;
  published?: boolean;
  board: {
    rows: number;
    cols: number;
    arrows: Array<{
      id: string;
      color: string;
      cells: string[];
      direction: string;
    }>;
    walls?: string[];
    collectibles?: Array<{ position: string; kind: string }>;
  };
}

/**
 * UpsertLevelUseCase — create or replace a level from admin input.
 *
 * Composes the domain constructors (which validate structural
 * invariants: dimensions, overlaps, whitelists, id uniqueness), then
 * runs BoardSolver.isSolvable to reject unwinnable puzzles at the
 * seam instead of shipping them into the catalog. Any failure raises
 * a plain Error → 500 via the exception filter; on success,
 * ILevelRepository.save() upserts the row by id.
 *
 * Framework-agnostic: no Nest imports. Wiring lives at the composition
 * root via useFactory.
 */
export class UpsertLevelUseCase {
  constructor(
    private readonly levels: ILevelRepository,
    private readonly solver: BoardSolver,
  ) {}

  async execute(command: UpsertLevelCommand): Promise<void> {
    const difficulty = DifficultyProfileFactory.create(command.difficulty);

    const arrows = command.board.arrows.map(
      (a) => new ArrowPathInfo(a.id, a.color, a.cells, a.direction),
    );
    const collectibles = (command.board.collectibles ?? []).map(
      (c) => new CollectibleInfo(c.position, c.kind),
    );

    const board = new BoardLayout({
      rows: command.board.rows,
      cols: command.board.cols,
      arrows,
      walls: command.board.walls ?? [],
      collectibles,
    });

    if (!this.solver.isSolvable(board)) {
      throw new Error(
        `UpsertLevelUseCase: board for level "${command.id}" is not solvable`,
      );
    }

    const level = new Level({
      id: command.id,
      index: command.index,
      difficulty,
      board,
      parTimeMs: command.parTimeMs,
      timeLimitMs: command.timeLimitMs ?? null,
      published: command.published ?? false,
    });

    await this.levels.save(level);
  }
}