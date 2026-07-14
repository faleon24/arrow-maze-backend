import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { GenerateLevelUseCase } from '../../application/usecases/levels/generate-level.usecase';
import { ListLevelsUseCase } from '../../application/usecases/levels/list-levels.usecase';
import { GenerateLevelDto } from './dto/generate-level.dto';
import { LevelResponseDto } from './dto/level-response.dto';

/**
 * LevelsController — HTTP entry point for the level catalog.
 *
 * Thin: delegate to the use case, map to DTO. GET is public (game
 * client loads the catalog before auth). POST /generate is also
 * public in this MVP so a "Get more levels" button can extend the
 * catalog on demand; a future revision can gate it behind AdminKeyGuard
 * if the professor wants restricted content authoring.
 */
@ApiTags('levels')
@Controller('levels')
export class LevelsController {
  constructor(
    private readonly listLevels: ListLevelsUseCase,
    private readonly generateLevel: GenerateLevelUseCase,
  ) {}

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

  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Generate a random level of the given difficulty',
    description:
      'Runs the solver-verified random board generator and persists ' +
      'the resulting puzzle as a new published level. Extends the ' +
      'catalog on demand so players never run out of content.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'The freshly generated and persisted level.',
    type: LevelResponseDto,
  })
  async generate(
    @Body() body: GenerateLevelDto,
  ): Promise<LevelResponseDto> {
    const level = await this.generateLevel.execute({
      difficulty: body.difficulty,
    });
    return LevelResponseDto.from(level);
  }
}
