import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GetLeaderboardUseCase } from '../../application/usecases/leaderboard/get-leaderboard.usecase';
import { GetLeaderboardQueryDto } from './dto/get-leaderboard-query.dto';
import { LeaderboardEntryResponseDto } from './dto/leaderboard-entry-response.dto';

/**
 * LeaderboardController — HTTP entry point for the leaderboard.
 *
 * Public route: leaderboard data is inherently shareable, not per-user.
 * Level id is validated as UUID v4 at the pipe; an unknown but
 * valid-shape id yields 200 with `[]` — the client can't distinguish
 * "no runs yet" from "wrong id" without a separate levels fetch, and
 * a 404 here would over-signal.
 */
@ApiTags('leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly getLeaderboard: GetLeaderboardUseCase) {}

  @Get(':levelId')
  @ApiOperation({ summary: 'Top runs for a level' })
  @ApiResponse({ status: 200, type: [LeaderboardEntryResponseDto] })
  async forLevel(
    @Param('levelId', new ParseUUIDPipe({ version: '4' })) levelId: string,
    @Query() query: GetLeaderboardQueryDto,
  ): Promise<LeaderboardEntryResponseDto[]> {
    const entries = await this.getLeaderboard.execute({
      levelId,
      limit: query.limit,
    });
    return entries.map((e) => LeaderboardEntryResponseDto.fromDomain(e));
  }
}