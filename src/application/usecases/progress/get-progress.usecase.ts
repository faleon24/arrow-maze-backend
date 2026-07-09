import { PlayerProgress } from '../../../domain/models/player-progress';
import { IProgressRepository } from '../../ports/out/progress-repository.port';
import { GetProgressCommand } from './get-progress.command';
import { UseCase } from '../use-case';

/**
 * GetProgressUseCase — returns the authenticated player's full progress
 * so the client can render the level map with stars and unlock state.
 *
 * Thin by design: the repository returns a complete (possibly empty)
 * aggregate, so there is nothing to decide here. It exists as a use
 * case — rather than the controller calling the repo directly — so it
 * fits the UseCase contract and is wrapped by the logging decorator
 * like every other one, and so future rules (e.g. computing unlock
 * state) have a home.
 *
 * DIP: depends only on the IProgressRepository abstraction.
 */
export class GetProgressUseCase
  implements UseCase<GetProgressCommand, PlayerProgress> {
  constructor(private readonly progressRepo: IProgressRepository) {}

  async execute(command: GetProgressCommand): Promise<PlayerProgress> {
    return this.progressRepo.findByUser(command.userId);
  }
}