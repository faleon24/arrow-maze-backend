import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { ListLevelsUseCase } from '../../application/usecases/levels/list-levels.usecase';
import { LevelResponseDto } from './dto/level-response.dto';

/**
 * LevelsController — HTTP entry point for the level catalog.
 *
 * Thin by design, exactly like AuthController:
 *   1. Delegate to the use case.
 *   2. Map each domain Level to its response DTO.
 * No business logic, no try/catch. This endpoint is public: the game
 * client loads the catalog before a player authenticates.
 */
@ApiTags('levels')
@Controller('levels')
export class LevelsController {
  constructor(private readonly listLevels: ListLevelsUseCase) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List the published level catalog',
    description:
      'Returns every published level, ordered by index. This is the ' +
      'catalog the game client loads to present playable puzzles.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The published levels.',
    type: [LevelResponseDto],
  })
  async list(): Promise<LevelResponseDto[]> {
    const levels = await this.listLevels.execute({});
    return levels.map((level) => LevelResponseDto.from(level));
  }
}