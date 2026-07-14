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
 * drafts), grade the run into stars using BOTH the moves used and
 * the time taken, load the player's progress, apply the "best score
 * wins, attempt counted" rule, then persist. The business decision
 * lives entirely in the aggregate; this use case only orchestrates.
 *
 * Grading:
 *   blockedTaps  = max(0, moves - arrowCount)  (every blocked tap
 *                                              costs a move but does
 *                                              not clear an arrow)
 *   movesBased   = clamp(3 - blockedTaps, 1, 3)
 *   timeBased    = difficulty.starsFor(timeMs)
 *   stars        = min(movesBased, timeBased)
 *
 * So a fast, mistake-free run earns 3 stars; a fast run with two
 * blocked taps earns 1; a mistake-free but slow run is capped by
 * the difficulty's time thresholds. The two axes bound each other
 * (worst-of), keeping the classic mobile-puzzle grading contract
 * (attempts matter) while still rewarding speed.
 *
 * Server authority:
 *   - The client sends moves + timeMs. It does NOT send stars.
 *   - The completion timestamp comes from IClock, not the client, so
 *     runs cannot be backdated.
 *   - The level's arrowCount is read from the persisted level, not
 *     from the client, so a client cannot inflate its rating by
 *     lying about how many arrows the board had.
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
    const arrowCount = level.board.arrows.length;
    const blockedTaps = Math.max(0, command.moves - arrowCount);
    const movesBased = Math.max(1, Math.min(3, 3 - blockedTaps));
    const timeBased = level.difficulty.starsFor(command.timeMs);
    const stars = Math.min(movesBased, timeBased);
    const score = new Score(command.moves, command.timeMs, stars);
    const progress = await this.progressRepo.findByUser(command.userId);
    progress.record(command.levelId, score, this.clock.now());
    await this.progressRepo.save(progress);
    return progress;
  }
}
