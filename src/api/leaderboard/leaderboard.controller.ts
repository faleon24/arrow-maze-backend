import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { GetLeaderboardUseCase } from '../../application/usecases/leaderboard/get-leaderboard.usecase';
import { GetMyRankUseCase } from '../../application/usecases/leaderboard/get-my-rank.usecase';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { GetLeaderboardQueryDto } from './dto/get-leaderboard-query.dto';
import { LeaderboardEntryResponseDto } from './dto/leaderboard-entry-response.dto';
import { MyRankResponseDto } from './dto/my-rank-response.dto';

/**
 * LeaderboardController — HTTP entry point for the leaderboard.
 *
 * The board itself is public (GET /:levelId): leaderboard data is
 * inherently shareable, not per-user. An unknown but valid-shape id
 * yields 200 with `[]` — the client can't distinguish "no runs yet"
 * from "wrong id" without a separate levels fetch, and a 404 here
 * would over-signal.
 *
 * "Where do I stand?" (GET /:levelId/me) is the one authenticated
 * route: the player's identity comes from the verified token, never a
 * URL param, so a player can only ever ask about their own standing.
 * It returns the player's rank + best run, or an empty body when they
 * have not cleared the level yet.
 */
@ApiTags('leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(
    private readonly getLeaderboard: GetLeaderboardUseCase,
    private readonly getMyRank: GetMyRankUseCase,
  ) {}

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

  @Get(':levelId/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "The authenticated player's rank on a level",
    description:
      "Returns the player's 1-based rank and best run on the level. " +
      'Returns an empty body (HTTP 200) when the player has not cleared ' +
      'the level yet. Requires a valid Bearer token.',
  })
  @ApiResponse({ status: 200, type: MyRankResponseDto })
  @ApiResponse({
    status: 401,
    description: 'Missing, malformed, or expired token.',
  })
  async myRank(
    @Param('levelId', new ParseUUIDPipe({ version: '4' })) levelId: string,
    @CurrentUserId() userId: string,
  ): Promise<MyRankResponseDto | undefined> {
    const result = await this.getMyRank.execute({ levelId, userId });
    return result === null ? undefined : MyRankResponseDto.fromDomain(result);
  }
}
