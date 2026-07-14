import { DifficultyProfileFactory } from '../../../domain/models/difficulty-profile.factory';
import { Level } from '../../../domain/models/level';
import { RandomBoardGenerator } from '../../../domain/services/random-board-generator';
import { IIdGenerator } from '../../ports/out/id-generator.port';
import { ILevelRepository } from '../../ports/out/level-repository.port';

export interface GenerateLevelCommand {
  difficulty: string;
}

/**
 * GenerateLevelUseCase — create and persist a fresh procedurally-
 * generated level.
 *
 * Composes RandomBoardGenerator (which solver-verifies its output) and
 * the DifficultyProfileFactory, then assembles a Level entity with:
 *   - id from IIdGenerator (production: UUID v4)
 *   - index = current catalog size (levels are 0-indexed and dense)
 *   - parTimeMs = baseline (15s per arrow) scaled by the difficulty's
 *     parTimeMultiplier (EASY 1.5x, MEDIUM 1x, HARD 0.75x)
 *   - published: true (generated levels are player-visible immediately)
 *
 * Persists via ILevelRepository.save. Framework-agnostic: no Nest
 * imports. Wiring lives at the composition root via useFactory.
 */
export class GenerateLevelUseCase {
  private static readonly MS_PER_ARROW = 15_000;

  constructor(
    private readonly levels: ILevelRepository,
    private readonly generator: RandomBoardGenerator,
    private readonly idGenerator: IIdGenerator,
  ) {}

  async execute(command: GenerateLevelCommand): Promise<Level> {
    const difficulty = DifficultyProfileFactory.create(command.difficulty);
    const board = this.generator.generate(command.difficulty);

    const existing = await this.levels.findAll();
    const nextIndex = existing.length;

    const baseParMs = board.arrows.length * GenerateLevelUseCase.MS_PER_ARROW;
    const parTimeMs = Math.floor(baseParMs * difficulty.parTimeMultiplier());

    const level = new Level({
      id: this.idGenerator.generate(),
      index: nextIndex,
      difficulty,
      board,
      parTimeMs,
      published: true,
    });

    await this.levels.save(level);
    return level;
  }
}
