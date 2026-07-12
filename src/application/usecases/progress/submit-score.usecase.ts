import { PlayerProgress } from '../../../domain/models/player-progress';
import { Score } from '../../../domain/models/score';
import { LevelNotFoundError } from '../../../domain/errors/level-not-found.error';
import { IProgressRepository } from '../../ports/out/progress-repository.port';
import { ILevelRepository } from '../../ports/out/level-repository.port';
import { IClock } from '../../ports/out/clock.port';
import { SubmitScoreCommand } from './submit-score.command';
import { UseCase } from '../use-case';
/**
 * SubmitScoreUseCase — records a completed run on a level for the
 * authenticated player, with the server computing the star rating.
 *
 * The flow: load the level to prove it exists AND is published (a
 * missing or draft level is a 404 — the client should never see
 * drafts), grade the run into stars via the level's DifficultyProfile
 * strategy, load the player's progress, apply the "best score wins,
 * attempt counted" rule, then persist. The business decision lives
 * entirely in the aggregate; this use case only orchestrates.
 *
 * Server authority:
 *   - The client sends moves + timeMs. It does NOT send stars.
 *   - starsFor(timeMs) is computed here from the level's difficulty
 *     strategy. A client that lies about time is still bounded by the
 *     level's time-limit rules; a client that tries to smuggle stars
 *     in the body is rejected at 400 by the ValidationPipe.
 *   - The completion timestamp comes from IClock, not the client, so
 *     runs cannot be backdated.
 *
 * DIP: depends only on port abstractions (IProgressRepository,
 * ILevelRepository, IClock).
 */
export class SubmitScoreUseCase
  implements UseCase<SubmitScoreCommand, PlayerProgress> {
  constructor(
    private readonly progressRepo: IProgressRepository,
    private readonly clock: IClock,
    private readonly levelRepo: ILevelRepository,
  ) {}
  async execute(command: SubmitScoreCommand): Promise<PlayerProgress> {
    const level = await this.levelRepo.findById(command.levelId);
    if (level === null || !level.published) {
      throw new LevelNotFoundError(command.levelId);
    }
    const stars = level.difficulty.starsFor(command.timeMs);
    const score = new Score(command.moves, command.timeMs, stars);
    const progress = await this.progressRepo.findByUser(command.userId);
    progress.record(command.levelId, score, this.clock.now());
    await this.progressRepo.save(progress);
    return progress;
  }
}