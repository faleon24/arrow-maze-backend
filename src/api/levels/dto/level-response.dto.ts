import { ApiProperty } from '@nestjs/swagger';
import { Level } from '../../../domain/models/level';
/**
 * Serialized arrow inside the v2 board response.
 */
class ArrowResponse {
  @ApiProperty({ description: 'Unique arrow id within the board.' })
  readonly id: string;
  @ApiProperty({
    description: 'Arrow color: PINK, GREEN, BLUE, YELLOW, or PURPLE.',
  })
  readonly color: string;
  @ApiProperty({
    description: 'Cells the arrow occupies, ordered tail → head.',
    type: [String],
  })
  readonly cells: string[];
  @ApiProperty({
    description: 'Arrow direction: UP, DOWN, LEFT, or RIGHT.',
  })
  readonly direction: string;
}
/**
 * Serialized collectible on the v2 board.
 */
class CollectibleResponse {
  @ApiProperty({ description: 'Cell position as "row,col".' })
  readonly position: string;
  @ApiProperty({ description: 'Collectible kind: STAR.' })
  readonly kind: string;
}
/**
 * Serialized board layout returned to the client (v2 contract).
 *
 * The `version` field is a hard signal for the client: an app that
 * only knows v1 (a flat "cells" list) will refuse to parse v2 rather
 * than silently misread it.
 */
class BoardResponse {
  @ApiProperty({ description: 'Contract version (currently 2).' })
  readonly version: number;
  @ApiProperty({ description: 'Number of rows in the grid.' })
  readonly rows: number;
  @ApiProperty({ description: 'Number of columns in the grid.' })
  readonly cols: number;
  @ApiProperty({
    description: 'Arrow-paths on the board.',
    type: [ArrowResponse],
  })
  readonly arrows: ArrowResponse[];
  @ApiProperty({
    description: 'Wall positions as "row,col".',
    type: [String],
  })
  readonly walls: string[];
  @ApiProperty({
    description: 'Bonus items on the board.',
    type: [CollectibleResponse],
  })
  readonly collectibles: CollectibleResponse[];
}
/**
 * LevelResponseDto — HTTP response body for the levels endpoints.
 *
 * Serializes a Level aggregate into the flat v2 shape the mobile app
 * consumes to render and play a puzzle. The difficulty is exposed as
 * its label string (the strategy's behavior stays server-side); the
 * effective par time — after the difficulty multiplier — is computed
 * here so the client gets the number it should actually enforce.
 * timeLimitMs is null when the level has no wall-clock deadline.
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
  @ApiProperty({
    description:
      'Hard time limit in ms; null means no wall-clock deadline.',
    nullable: true,
  })
  readonly timeLimitMs: number | null;
  @ApiProperty({ description: 'The board layout to render and play.' })
  readonly board: BoardResponse;
  @ApiProperty({ description: 'Whether the level is published to players.' })
  readonly published: boolean;
  private constructor(
    id: string,
    index: number,
    difficulty: string,
    parTimeMs: number,
    timeLimitMs: number | null,
    board: BoardResponse,
    published: boolean,
  ) {
    this.id = id;
    this.index = index;
    this.difficulty = difficulty;
    this.parTimeMs = parTimeMs;
    this.timeLimitMs = timeLimitMs;
    this.board = board;
    this.published = published;
  }
  static from(level: Level): LevelResponseDto {
    const board: BoardResponse = {
      version: 2,
      rows: level.board.rows,
      cols: level.board.cols,
      arrows: level.board.arrows.map((a) => ({
        id: a.id,
        color: a.color,
        cells: [...a.cells],
        direction: a.direction,
      })),
      walls: [...level.board.walls],
      collectibles: level.board.collectibles.map((c) => ({
        position: c.position,
        kind: c.kind,
      })),
    };
    return new LevelResponseDto(
      level.id,
      level.index,
      level.difficulty.label(),
      level.effectiveParTimeMs(),
      level.timeLimitMs,
      board,
      level.published,
    );
  }
}