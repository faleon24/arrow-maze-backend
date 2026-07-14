import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;

/**
 * GenerateLevelDto — request body for POST /levels/generate.
 *
 * Whitelisted difficulty labels (project rule: no enums). Any other
 * value fails validation at the seam and returns 400 before the use
 * case runs.
 */
export class GenerateLevelDto {
  @ApiProperty({
    description: 'Difficulty tier for the generated level.',
    enum: DIFFICULTIES,
  })
  @IsString()
  @IsIn(DIFFICULTIES as unknown as string[])
  readonly difficulty!: string;
}
