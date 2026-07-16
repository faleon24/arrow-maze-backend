import { ApiProperty } from '@nestjs/swagger';
import { MyRank } from '../../../application/usecases/leaderboard/get-my-rank.usecase';
import { LeaderboardEntryResponseDto } from './leaderboard-entry-response.dto';

/**
 * MyRankResponseDto — the authenticated player's standing on a level as
 * it crosses the HTTP boundary: their 1-based rank plus their best run.
 *
 * When the player has no run on the level the controller returns an
 * empty body instead of this shape, so the client distinguishes "not
 * played yet" from a real ranking without a sentinel rank value.
 */
export class MyRankResponseDto {
  @ApiProperty({ example: 7, description: '1-based position on the level.' })
  rank!: number;

  @ApiProperty({ type: LeaderboardEntryResponseDto })
  entry!: LeaderboardEntryResponseDto;

  static fromDomain(myRank: MyRank): MyRankResponseDto {
    const dto = new MyRankResponseDto();
    dto.rank = myRank.rank;
    dto.entry = LeaderboardEntryResponseDto.fromDomain(myRank.entry);
    return dto;
  }
}
