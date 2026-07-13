import { ShopItem } from '../../../src/domain/models/shop-item';

describe('ShopItem', () => {
  const validProps = {
    id: 'item-1',
    name: 'Neon Theme',
    costCoins: 100,
    kind: 'COSMETIC',
  };

  describe('construction', () => {
    it('should_expose_fields_when_constructed_with_valid_props', () => {
      const item = new ShopItem(validProps);

      expect(item.id).toBe('item-1');
      expect(item.name).toBe('Neon Theme');
      expect(item.costCoins).toBe(100);
      expect(item.kind).toBe('COSMETIC');
    });

    it('should_accept_zero_cost_when_item_is_a_freebie', () => {
      const item = new ShopItem({ ...validProps, costCoins: 0 });
      expect(item.costCoins).toBe(0);
    });

    it('should_normalize_kind_to_uppercase', () => {
      const item = new ShopItem({ ...validProps, kind: 'cosmetic' });
      expect(item.kind).toBe('COSMETIC');
    });

    it('should_accept_powerup_kind', () => {
      const item = new ShopItem({ ...validProps, kind: 'POWERUP' });
      expect(item.kind).toBe('POWERUP');
    });

    it('should_throw_when_id_is_blank', () => {
      expect(() => new ShopItem({ ...validProps, id: '  ' })).toThrow(/id/);
    });

    it('should_throw_when_name_is_blank', () => {
      expect(() => new ShopItem({ ...validProps, name: '  ' })).toThrow(
        /name/,
      );
    });

    it('should_throw_when_costCoins_is_negative', () => {
      expect(
        () => new ShopItem({ ...validProps, costCoins: -1 }),
      ).toThrow(/costCoins/);
    });

    it('should_throw_when_costCoins_is_not_an_integer', () => {
      expect(
        () => new ShopItem({ ...validProps, costCoins: 1.5 }),
      ).toThrow(/costCoins/);
    });

    it('should_throw_when_kind_is_unknown', () => {
      expect(
        () => new ShopItem({ ...validProps, kind: 'MYSTERY' }),
      ).toThrow(/unknown kind/i);
    });
  });

  describe('equals', () => {
    it('should_return_true_when_all_fields_match', () => {
      const a = new ShopItem(validProps);
      const b = new ShopItem({ ...validProps });

      expect(a.equals(b)).toBe(true);
    });

    it('should_return_false_when_cost_differs', () => {
      const a = new ShopItem(validProps);
      const b = new ShopItem({ ...validProps, costCoins: 200 });

      expect(a.equals(b)).toBe(false);
    });
  });
});