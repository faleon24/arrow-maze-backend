import { Level } from '../../../domain/models/level';
import { ILevelRepository } from '../../ports/out/level-repository.port';
import { ListLevelsCommand } from './list-levels.command';
import { UseCase } from '../use-case';

/**
 * ListLevelsUseCase — returns the published level catalog for the
 * game client, ordered by index.
 *
 * The use case is deliberately thin: the "only published, ordered by
 * index" rule is expressed by the repository method it calls, so the
 * application layer stays free of persistence concerns while still
 * owning the intent. It implements UseCase so the composition root can
 * wrap it in the LoggingUseCaseDecorator like every other use case.
 *
 * DIP: depends only on the ILevelRepository abstraction.
 */
export class ListLevelsUseCase
  implements UseCase<ListLevelsCommand, Level[]> {
  constructor(private readonly levels: ILevelRepository) {}

  async execute(_command: ListLevelsCommand): Promise<Level[]> {
    return this.levels.findAllPublished();
  }
}