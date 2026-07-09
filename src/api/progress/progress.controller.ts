import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';

import { SubmitScoreUseCase } from '../../application/usecases/progress/submit-score.usecase';
import { GetProgressUseCase } from '../../application/usecases/progress/get-progress.usecase';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { SubmitScoreDto } from './dto/submit-score.dto';
import { ProgressResponseDto } from './dto/progress-response.dto';

/**
 * ProgressController — HTTP entry point for a player's progress.
 *
 * Both routes are protected by JwtAuthGuard: the player's identity
 * comes from the verified token, never from the request body or a URL
 * param. The controller reads request.userId (attached by the guard)
 * and passes it into the use case — a player can only ever read or
 * write their own progress.
 *
 * Thin by design, like AuthController: translate, delegate, map. No
 * business logic, no try/catch.
 */
@ApiTags('progress')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me/progress')
export class ProgressController {
  constructor(
    private readonly submitScore: SubmitScoreUseCase,
    private readonly getProgress: GetProgressUseCase,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Get the authenticated player's progress",
    description:
      'Returns every level the player has completed, with their best ' +
      'score and attempt count. Requires a valid Bearer token.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The player progress.',
    type: ProgressResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing, malformed, or expired token.',
  })
  async get(@Req() request: Request): Promise<ProgressResponseDto> {
    const userId = (request as Request & { userId: string }).userId;
    const progress = await this.getProgress.execute({ userId });
    return ProgressResponseDto.from(progress);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit a completed run on a level',
    description:
      'Records a run for the authenticated player. The best score is ' +
      'kept and the attempt is counted. Returns the updated progress.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Run recorded; updated progress returned.',
    type: ProgressResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation failed (bad stars, negative values, etc.).',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing, malformed, or expired token.',
  })
  async submit(
    @Req() request: Request,
    @Body() dto: SubmitScoreDto,
  ): Promise<ProgressResponseDto> {
    const userId = (request as Request & { userId: string }).userId;
    const progress = await this.submitScore.execute({
      userId,
      levelId: dto.levelId,
      moves: dto.moves,
      timeMs: dto.timeMs,
      stars: dto.stars,
    });
    return ProgressResponseDto.from(progress);
  }
}