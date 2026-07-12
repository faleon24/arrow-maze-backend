import { CollectibleInfo } from '../../../src/domain/models/collectible-info';
describe('CollectibleInfo', () => {
  describe('construction', () => {
    it('should_build_a_star_when_position_and_kind_are_valid', () => {
      // Arrange & Act
      const c = new CollectibleInfo('2,6', 'STAR');
      // Assert
      expect(c.position).toBe('2,6');
      expect(c.kind).toBe('STAR');
    });
    it('should_normalize_case_when_kind_is_lowercase', () => {
      // Arrange & Act
      const c = new CollectibleInfo('0,0', 'star');
      // Assert
      expect(c.kind).toBe('STAR');
    });
  });
  describe('validation', () => {
    it('should_throw_when_position_has_a_negative_coordinate', () => {
      expect(() => new CollectibleInfo('1,-1', 'STAR')).toThrow(/row,col/);
    });
    it('should_throw_when_position_carries_whitespace', () => {
      expect(() => new CollectibleInfo(' 1,1', 'STAR')).toThrow(/row,col/);
    });
    it('should_throw_when_position_is_the_empty_string', () => {
      // Guards the Number('') === 0 quirk — an empty position must
      // NOT silently succeed as (0,0).
      expect(() => new CollectibleInfo('', 'STAR')).toThrow(/row,col/);
    });
    it('should_throw_when_position_is_not_numeric', () => {
      expect(() => new CollectibleInfo('abc', 'STAR')).toThrow(/row,col/);
    });
    it('should_throw_when_kind_is_not_in_the_whitelist', () => {
      expect(() => new CollectibleInfo('0,0', 'HEART')).toThrow(
        /Unknown collectible kind/,
      );
    });
  });
  describe('toJSON', () => {
    it('should_return_a_plain_v2_snapshot_when_serialized', () => {
      // Arrange
      const c = new CollectibleInfo('4,5', 'STAR');
      // Act
      const json = c.toJSON();
      // Assert
      expect(json).toEqual({ position: '4,5', kind: 'STAR' });
    });
  });
});