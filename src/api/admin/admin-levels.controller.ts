import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { UpsertLevelUseCase } from '../../application/usecases/levels/upsert-level.usecase';
import { AdminKeyGuard } from '../guards/admin-key.guard';
import { UpsertLevelDto } from './dto/upsert-level.dto';

/**
 * AdminLevelsController — internal tooling for the level catalog.
 *
 * Protected by AdminKeyGuard (X-Admin-Key header vs ADMIN_API_KEY env).
 * A single POST endpoint: upsert-by-id semantics, 204 No Content on
 * success. Validation runs at three tiers — DTO shape at the pipe,
 * domain invariants at the value-object constructors, solvability at
 * BoardSolver inside the use case. Anything that fails becomes a 4xx
 * (DTO) or 500 (domain error) that the caller can read from the body.
 */
@ApiTags('admin')
@Controller('admin/levels')
@UseGuards(AdminKeyGuard)
export class AdminLevelsController {
  constructor(private readonly upsert: UpsertLevelUseCase) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Create or replace a level (admin only)' })
  @ApiResponse({ status: 204, description: 'Level upserted' })
  @ApiResponse({ status: 400, description: 'Invalid body' })
  @ApiResponse({ status: 401, description: 'Missing or wrong admin key' })
  async upsertLevel(@Body() dto: UpsertLevelDto): Promise<void> {
    await this.upsert.execute({
      id: dto.id,
      index: dto.index,
      difficulty: dto.difficulty,
      parTimeMs: dto.parTimeMs,
      timeLimitMs: dto.timeLimitMs,
      published: dto.published,
      board: {
        rows: dto.board.rows,
        cols: dto.board.cols,
        arrows: dto.board.arrows,
        walls: dto.board.walls,
        collectibles: dto.board.collectibles,
      },
    });
  }
}