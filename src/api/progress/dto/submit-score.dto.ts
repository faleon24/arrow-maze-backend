import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Max, Min, IsNotEmpty } from 'class-validator';

/**
 * SubmitScoreDto — request body for POST /me/progress.
 *
 * Note what is NOT here: the userId. It never comes from the client —
 * it is taken from the verified JWT by the guard. A player can only
 * ever submit their own progress, so accepting a userId in the body
 * would be a security hole. The controller supplies it from the token.
 *
 * The validation bounds (stars 0..3, non-negative moves/time) mean a
 * malformed run is rejected with a 400 by the ValidationPipe before it
 * ever reaches the use case or the Score value object.
 */
export class SubmitScoreDto {
  @ApiProperty({ description: 'Id of the level that was completed.' })
  @IsString()
  @IsNotEmpty()
  readonly levelId: string;

  @ApiProperty({ description: 'Number of moves used in the run.', minimum: 0 })
  @IsInt()
  @Min(0)
  readonly moves: number;

  @ApiProperty({ description: 'Completion time in milliseconds.', minimum: 0 })
  @IsInt()
  @Min(0)
  readonly timeMs: number;

  @ApiProperty({ description: 'Stars earned (0-3).', minimum: 0, maximum: 3 })
  @IsInt()
  @Min(0)
  @Max(3)
  readonly stars: number;
}