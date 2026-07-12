import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Min } from 'class-validator';
/**
 * SubmitScoreDto — request body for POST /me/progress.
 *
 * Note what is NOT here:
 *   - userId: taken from the verified JWT, never from the client.
 *   - stars: computed server-side from timeMs and the level's difficulty
 *     profile. A client that sends `stars` in the body receives 400
 *     (ValidationPipe's forbidNonWhitelisted flag rejects unknown
 *     fields). This closes the audit finding where a malicious client
 *     could set stars = 3 for any run to unlock content it did not earn.
 *
 * Validation guards:
 *   - levelId must be a UUIDv4 (matches the id shape the seed and the
 *     admin upsert emit). A junk id is rejected at 400 before the use
 *     case runs, so a level-not-found path only ever fires on a
 *     legitimately-formed id that missed in the repository.
 *   - moves and timeMs are non-negative integers. Score itself will
 *     re-validate range, but the pipe catches the shape error first.
 */
export class SubmitScoreDto {
  @ApiProperty({ description: 'UUIDv4 of the level that was completed.' })
  @IsUUID('4')
  readonly levelId: string;
  @ApiProperty({ description: 'Number of moves used in the run.', minimum: 0 })
  @IsInt()
  @Min(0)
  readonly moves: number;
  @ApiProperty({ description: 'Completion time in milliseconds.', minimum: 0 })
  @IsInt()
  @Min(0)
  readonly timeMs: number;
}