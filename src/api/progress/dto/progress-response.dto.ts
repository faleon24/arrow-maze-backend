import { ApiProperty } from '@nestjs/swagger';
import { PlayerProgress } from '../../../domain/models/player-progress';

/**
 * One level's standing in the serialized progress response.
 */
class LevelProgressResponse {
  @ApiProperty({ description: 'Id of the level.' })
  readonly levelId: string;

  @ApiProperty({ description: 'Best number of moves achieved.' })
  readonly moves: number;

  @ApiProperty({ description: 'Best completion time in milliseconds.' })
  readonly timeMs: number;

  @ApiProperty({ description: 'Best stars earned (0-3).' })
  readonly stars: number;

  @ApiProperty({ description: 'Total attempts on this level.' })
  readonly attempts: number;

  @ApiProperty({
    description: 'When the level was first completed (ISO 8601).',
    format: 'date-time',
  })
  readonly completedAt: string;
}

/**
 * ProgressResponseDto — HTTP response body for the progress endpoints.
 *
 * Serializes a PlayerProgress aggregate into the flat shape the client
 * needs to render the level map: one entry per completed level, each
 * carrying its best score and attempt count. The player's identity is
 * implicit (it is the authenticated caller) so it is not echoed back.
 */
export class ProgressResponseDto {
  @ApiProperty({
    description: 'Per-level progress entries.',
    type: [LevelProgressResponse],
  })
  readonly entries: LevelProgressResponse[];

  private constructor(entries: LevelProgressResponse[]) {
    this.entries = entries;
  }

  static from(progress: PlayerProgress): ProgressResponseDto {
    const entries: LevelProgressResponse[] = progress.entries.map((entry) => ({
      levelId: entry.levelId,
      moves: entry.bestScore.moves,
      timeMs: entry.bestScore.timeMs,
      stars: entry.bestScore.stars,
      attempts: entry.attempts,
      completedAt: entry.completedAt.toISOString(),
    }));

    return new ProgressResponseDto(entries);
  }
}