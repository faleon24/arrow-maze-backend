import { ApiProperty } from '@nestjs/swagger';
import { Level } from '../../../domain/models/level';

/**
 * Serialized shape of one cell inside the board, as returned to the
 * client. Direction is only present on arrow cells.
 */
class CellResponse {
  @ApiProperty({ description: 'Cell position as "row,col" (0-indexed).' })
  readonly position: string;

  @ApiProperty({
    description: 'Cell type: EMPTY, WALL, ARROW, EXIT, or START.',
  })
  readonly type: string;

  @ApiProperty({
    description: 'Arrow direction (UP/DOWN/LEFT/RIGHT). Only on arrow cells.',
    required: false,
  })
  readonly direction?: string;
}

/**
 * Serialized board layout returned to the client.
 */
class BoardResponse {
  @ApiProperty({ description: 'Number of rows in the grid.' })
  readonly rows: number;

  @ApiProperty({ description: 'Number of columns in the grid.' })
  readonly cols: number;

  @ApiProperty({
    description: 'All cells that populate the grid.',
    type: [CellResponse],
  })
  readonly cells: CellResponse[];
}

/**
 * LevelResponseDto — HTTP response body for the levels endpoints.
 *
 * Serializes a Level aggregate into the flat shape the mobile app
 * consumes to render and play a puzzle. The difficulty is exposed as
 * its label string (the strategy's behavior stays server-side); the
 * effective par time — after the difficulty multiplier — is computed
 * here so the client gets the number it should actually enforce.
 */
export class LevelResponseDto {
  @ApiProperty({ description: 'Unique level id (UUID).' })
  readonly id: string;

  @ApiProperty({ description: 'Ordering index of the level (0-based).' })
  readonly index: number;

  @ApiProperty({ description: 'Difficulty label: EASY, MEDIUM, or HARD.' })
  readonly difficulty: string;

  @ApiProperty({
    description: 'Effective par time in milliseconds, difficulty applied.',
  })
  readonly parTimeMs: number;

  @ApiProperty({ description: 'The board layout to render and play.' })
  readonly board: BoardResponse;

  @ApiProperty({ description: 'Whether the level is published to players.' })
  readonly published: boolean;

  private constructor(
    id: string,
    index: number,
    difficulty: string,
    parTimeMs: number,
    board: BoardResponse,
    published: boolean,
  ) {
    this.id = id;
    this.index = index;
    this.difficulty = difficulty;
    this.parTimeMs = parTimeMs;
    this.board = board;
    this.published = published;
  }

  static from(level: Level): LevelResponseDto {
    const board: BoardResponse = {
      rows: level.board.rows,
      cols: level.board.cols,
      cells: level.board.cells.map((c) => {
        const direction = c.direction;
        return direction === null
          ? { position: c.position, type: c.type }
          : { position: c.position, type: c.type, direction };
      }),
    };

    return new LevelResponseDto(
      level.id,
      level.index,
      level.difficulty.label(),
      level.effectiveParTimeMs(),
      board,
      level.published,
    );
  }
}