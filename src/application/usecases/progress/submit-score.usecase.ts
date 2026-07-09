import { PlayerProgress } from '../../../domain/models/player-progress';
import { Score } from '../../../domain/models/score';
import { IProgressRepository } from '../../ports/out/progress-repository.port';
import { IClock } from '../../ports/out/clock.port';
import { SubmitScoreCommand } from './submit-score.command';
import { UseCase } from '../use-case';

/**
 * SubmitScoreUseCase — records a completed run on a level for the
 * authenticated player.
 *
 * The flow: load the player's full progress aggregate, build a Score
 * value object from the raw command (which validates it), let the
 * aggregate apply the "best score wins, attempt counted" rule, then
 * persist. The business decision lives entirely in the aggregate; this
 * use case only orchestrates load -> mutate -> save.
 *
 * The completion timestamp comes from the IClock port, not from the
 * client — the server owns time, so a client cannot backdate a run.
 *
 * DIP: depends only on IProgressRepository and IClock abstractions.
 */
export class SubmitScoreUseCase
  implements UseCase<SubmitScoreCommand, PlayerProgress> {
  constructor(
    private readonly progressRepo: IProgressRepository,
    private readonly clock: IClock,
  ) {}

  async execute(command: SubmitScoreCommand): Promise<PlayerProgress> {
    const score = new Score(command.moves, command.timeMs, command.stars);

    const progress = await this.progressRepo.findByUser(command.userId);
    progress.record(command.levelId, score, this.clock.now());

    await this.progressRepo.save(progress);
    return progress;
  }
}