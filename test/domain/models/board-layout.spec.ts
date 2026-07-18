import { BoardLayout } from '../../../src/domain/models/board-layout';
import { ArrowPathInfo } from '../../../src/domain/models/arrow-path-info';
import { CollectibleInfo } from '../../../src/domain/models/collectible-info';
describe('BoardLayout (v2)', () => {
  const arrow = (
    id: string,
    color: string,
    cells: string[],
    dir: string,
  ) => new ArrowPathInfo(id, color, cells, dir);
  describe('construction', () => {
    it('should_build_a_minimal_board_when_only_one_arrow_is_present', () => {
      // Arrange & Act
      const layout = new BoardLayout({
        rows: 3,
        cols: 3,
        arrows: [arrow('a1', 'PINK', ['0,0'], 'E')],
      });
      // Assert
      expect(layout.rows).toBe(3);
      expect(layout.cols).toBe(3);
      expect(layout.arrows).toHaveLength(1);
      expect(layout.walls).toEqual([]);
      expect(layout.collectibles).toEqual([]);
    });
    it('should_build_a_board_with_arrows_walls_and_collectibles', () => {
      // Arrange & Act
      const layout = new BoardLayout({
        rows: 5,
        cols: 5,
        arrows: [arrow('a1', 'PINK', ['0,0', '0,1'], 'E')],
        walls: ['4,4'],
        collectibles: [new CollectibleInfo('2,2', 'STAR')],
      });
      // Assert
      expect(layout.walls).toEqual(['4,4']);
      expect(layout.collectibles).toHaveLength(1);
    });

    it('should_build_a_board_with_bent_arrows_that_do_not_overlap', () => {
      // Arrange & Act
      const layout = new BoardLayout({
        rows: 5,
        cols: 5,
        arrows: [
          arrow('L1', 'GREEN', ['4,0', '4,1', '3,1'], 'NE'),
          arrow('U1', 'BLUE', ['0,0', '0,1', '0,2', '1,2', '2,2'], 'SE'),
        ],
      });
      // Assert
      expect(layout.arrows).toHaveLength(2);
      expect(layout.arrows[0].head).toBe('3,1');
      expect(layout.arrows[1].head).toBe('2,2');
    });
  });
  describe('validation - dimensions', () => {
    it('should_throw_when_rows_is_zero', () => {
      expect(
        () =>
          new BoardLayout({
            rows: 0,
            cols: 3,
            arrows: [arrow('a1', 'PINK', ['0,0'], 'NE')],
          }),
      ).toThrow(/rows/);
    });
    it('should_throw_when_cols_is_negative', () => {
      expect(
        () =>
          new BoardLayout({
            rows: 3,
            cols: -1,
            arrows: [arrow('a1', 'PINK', ['0,0'], 'NE')],
          }),
      ).toThrow(/cols/);
    });
  });
  describe('validation - arrows', () => {
    it('should_throw_when_arrows_is_empty', () => {
      expect(
        () => new BoardLayout({ rows: 3, cols: 3, arrows: [] }),
      ).toThrow(/at least one arrow/);
    });
    it('should_throw_when_two_arrows_share_the_same_id', () => {
      expect(
        () =>
          new BoardLayout({
            rows: 3,
            cols: 3,
            arrows: [
              arrow('a1', 'PINK', ['0,0'], 'NE'),
              arrow('a1', 'BLUE', ['1,1'], 'NE'),
            ],
          }),
      ).toThrow(/duplicate arrow id/);
    });
    it('should_throw_when_an_arrow_segment_is_outside_the_grid', () => {
      expect(
        () =>
          new BoardLayout({
            rows: 3,
            cols: 3,
            arrows: [arrow('a1', 'PINK', ['3,0'], 'NE')],
          }),
      ).toThrow(/outside a 3x3 grid/);
    });
    it('should_throw_when_two_arrows_share_a_cell', () => {
      expect(
        () =>
          new BoardLayout({
            rows: 3,
            cols: 3,
            arrows: [
              arrow('a1', 'PINK', ['0,0', '0,1'], 'E'),
              arrow('a2', 'BLUE', ['0,1', '0,2'], 'E'),
            ],
          }),
      ).toThrow(/overlap at "0,1"/);
    });
  });
  it('should_throw_when_two_bent_arrows_share_a_cell_at_a_turn', () => {
      expect(
        () =>
          new BoardLayout({
            rows: 4,
            cols: 4,
            arrows: [
              arrow('a1', 'PINK', ['0,0', '0,1', '1,1'], 'SE'),
              arrow('a2', 'BLUE', ['1,1', '2,1'], 'SW'),
            ],
          }),
      ).toThrow(/overlap/);
    });
  describe('validation - walls', () => {
    it('should_throw_when_wall_position_has_bad_format', () => {
      expect(
        () =>
          new BoardLayout({
            rows: 3,
            cols: 3,
            arrows: [arrow('a1', 'PINK', ['0,0'], 'NE')],
            walls: ['1,-1'],
          }),
      ).toThrow(/wall position must match/);
    });
    it('should_throw_when_wall_is_outside_the_grid', () => {
      expect(
        () =>
          new BoardLayout({
            rows: 3,
            cols: 3,
            arrows: [arrow('a1', 'PINK', ['0,0'], 'NE')],
            walls: ['3,3'],
          }),
      ).toThrow(/outside a 3x3 grid/);
    });
    it('should_throw_when_wall_position_repeats', () => {
      expect(
        () =>
          new BoardLayout({
            rows: 3,
            cols: 3,
            arrows: [arrow('a1', 'PINK', ['0,0'], 'NE')],
            walls: ['1,1', '1,1'],
          }),
      ).toThrow(/duplicate wall/);
    });
    it('should_throw_when_wall_sits_on_an_arrow_cell', () => {
      expect(
        () =>
          new BoardLayout({
            rows: 3,
            cols: 3,
            arrows: [arrow('a1', 'PINK', ['1,1'], 'NE')],
            walls: ['1,1'],
          }),
      ).toThrow(/overlap at "1,1".*wall/);
    });
  });
  describe('validation - collectibles', () => {
    it('should_throw_when_collectible_position_repeats', () => {
      expect(
        () =>
          new BoardLayout({
            rows: 3,
            cols: 3,
            arrows: [arrow('a1', 'PINK', ['0,0'], 'NE')],
            collectibles: [
              new CollectibleInfo('2,2', 'STAR'),
              new CollectibleInfo('2,2', 'STAR'),
            ],
          }),
      ).toThrow(/duplicate collectible/);
    });
    it('should_throw_when_collectible_sits_on_an_arrow', () => {
      expect(
        () =>
          new BoardLayout({
            rows: 3,
            cols: 3,
            arrows: [arrow('a1', 'PINK', ['1,1'], 'NE')],
            collectibles: [new CollectibleInfo('1,1', 'STAR')],
          }),
      ).toThrow(/overlap at "1,1".*collectible/);
    });
    it('should_throw_when_collectible_sits_on_a_wall', () => {
      expect(
        () =>
          new BoardLayout({
            rows: 3,
            cols: 3,
            arrows: [arrow('a1', 'PINK', ['0,0'], 'NE')],
            walls: ['2,2'],
            collectibles: [new CollectibleInfo('2,2', 'STAR')],
          }),
      ).toThrow(/overlap at "2,2".*collectible/);
    });
  });
  describe('toJSON', () => {
    it('should_emit_the_v2_contract_when_serialized', () => {
      // Arrange
      const layout = new BoardLayout({
        rows: 3,
        cols: 3,
        arrows: [arrow('a1', 'PINK', ['0,0', '0,1'], 'E')],
        walls: ['2,2'],
        collectibles: [new CollectibleInfo('1,2', 'STAR')],
      });
      // Act
      const json = layout.toJSON();
      // Assert
      expect(json).toEqual({
        version: 2,
        rows: 3,
        cols: 3,
        arrows: [
          {
            id: 'a1',
            color: 'PINK',
            cells: ['0,0', '0,1'],
            direction: 'E',
          },
        ],
        walls: ['2,2'],
        collectibles: [{ position: '1,2', kind: 'STAR' }],
      });
    });
  });
});
