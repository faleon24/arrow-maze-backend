import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * GetLeaderboardQueryDto — validates ?limit=N in the query string.
 * Bounds mirror the use case's constants so the pipe catches out-of-
 * range values as 400 BadRequest instead of letting the use case throw
 * as a 500 (plain Error → InternalServerError by default).
 */
export class GetLeaderboardQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}