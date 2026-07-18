import { BoardSolver } from '../../../../src/domain/services/board-solver';
import { Level } from '../../../../src/domain/models/level';
import { ILevelRepository } from '../../../../src/application/ports/out/level-repository.port';
import { UpsertLevelUseCase } from '../../../../src/application/usecases/levels/upsert-level.usecase';

/**
 * Builds a minimal valid command — 1x3 grid, single east-facing arrow
 * with a clear ray to the edge, EASY difficulty, unpublished. Tests
 * override whatever they need to exercise a specific failure mode.
 */
const buildCommand = (
  overrides: {
    difficulty?: string;
    arrows?: Array<{
      id: string;
      color: string;
      cells: string[];
      direction: string;
    }>;
    walls?: string[];
  } = {},
) => ({
  id: '11111111-1111-4111-8111-111111111111',
  index: 0,
  difficulty: overrides.difficulty ?? 'EASY',
  parTimeMs: 60_000,
  timeLimitMs: null,
  published: true,
  board: {
    rows: 1,
    cols: 3,
    arrows: overrides.arrows ?? [
      { id: 'a1', color: 'PINK', cells: ['0,0'], direction: 'E' },
    ],
    walls: overrides.walls ?? [],
    collectibles: [],
  },
});

describe('UpsertLevelUseCase', () => {
  let saveMock: jest.Mock;
  let repo: ILevelRepository;
  let solver: BoardSolver;
  let useCase: UpsertLevelUseCase;

  beforeEach(() => {
    saveMock = jest.fn().mockResolvedValue(undefined);
    repo = { save: saveMock } as unknown as ILevelRepository;
    solver = new BoardSolver();
    useCase = new UpsertLevelUseCase(repo, solver);
  });

  it('should_save_a_valid_level_when_command_is_solvable', async () => {
    await useCase.execute(buildCommand());

    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(saveMock.mock.calls[0][0]).toBeInstanceOf(Level);
  });

  it('should_throw_when_difficulty_label_is_unknown', async () => {
    await expect(
      useCase.execute(buildCommand({ difficulty: 'INSANE' })),
    ).rejects.toThrow(/difficulty/i);
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('should_throw_when_board_is_not_solvable', async () => {
    // Two arrows blocking each other's rays — greedy solver stalls.
    await expect(
      useCase.execute(
        buildCommand({
          arrows: [
            { id: 'a1', color: 'PINK', cells: ['0,0'], direction: 'E' },
            { id: 'a2', color: 'BLUE', cells: ['0,1'], direction: 'W' },
          ],
        }),
      ),
    ).rejects.toThrow(/not solvable/i);
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('should_throw_when_board_layout_has_overlap', async () => {
    // Wall on the same cell as the arrow — BoardLayout invariant fails.
    await expect(
      useCase.execute(buildCommand({ walls: ['0,0'] })),
    ).rejects.toThrow();
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('should_propagate_repository_errors_when_save_fails', async () => {
    saveMock.mockRejectedValue(new Error('db down'));

    await expect(useCase.execute(buildCommand())).rejects.toThrow(/db down/);
  });
});
