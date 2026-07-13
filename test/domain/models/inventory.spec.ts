import {
  AlreadyOwnedError,
  Inventory,
} from '../../../src/domain/models/inventory';

describe('Inventory', () => {
  describe('construction', () => {
    it('should_expose_userId_and_empty_items_when_constructed_without_items', () => {
      const inv = new Inventory({ userId: 'user-1' });

      expect(inv.userId).toBe('user-1');
      expect(inv.itemIds).toEqual([]);
      expect(inv.size).toBe(0);
    });

    it('should_expose_provided_items_when_constructed_with_them', () => {
      const inv = new Inventory({
        userId: 'user-1',
        itemIds: ['item-a', 'item-b'],
      });

      expect(inv.itemIds).toEqual(['item-a', 'item-b']);
      expect(inv.size).toBe(2);
    });

    it('should_throw_when_userId_is_blank', () => {
      expect(() => new Inventory({ userId: '  ' })).toThrow(/userId/);
    });

    it('should_throw_when_any_item_id_is_blank', () => {
      expect(
        () => new Inventory({ userId: 'user-1', itemIds: ['a', '  '] }),
      ).toThrow(/item id/);
    });

    it('should_throw_when_item_ids_contain_a_duplicate', () => {
      expect(
        () =>
          new Inventory({
            userId: 'user-1',
            itemIds: ['item-a', 'item-a'],
          }),
      ).toThrow(/duplicate/);
    });
  });

  describe('owns', () => {
    it('should_return_true_when_item_is_owned', () => {
      const inv = new Inventory({
        userId: 'user-1',
        itemIds: ['item-a'],
      });

      expect(inv.owns('item-a')).toBe(true);
    });

    it('should_return_false_when_item_is_not_owned', () => {
      const inv = new Inventory({
        userId: 'user-1',
        itemIds: ['item-a'],
      });

      expect(inv.owns('item-b')).toBe(false);
    });
  });

  describe('add', () => {
    it('should_add_a_new_item_when_not_yet_owned', () => {
      const inv = new Inventory({ userId: 'user-1' });

      inv.add('item-a');

      expect(inv.owns('item-a')).toBe(true);
      expect(inv.size).toBe(1);
    });

    it('should_throw_AlreadyOwnedError_when_item_is_already_owned', () => {
      const inv = new Inventory({
        userId: 'user-1',
        itemIds: ['item-a'],
      });

      expect(() => inv.add('item-a')).toThrow(AlreadyOwnedError);
    });

    it('should_expose_userId_and_itemId_on_error', () => {
      const inv = new Inventory({
        userId: 'user-1',
        itemIds: ['item-a'],
      });

      try {
        inv.add('item-a');
        fail('expected AlreadyOwnedError');
      } catch (e) {
        expect(e).toBeInstanceOf(AlreadyOwnedError);
        const err = e as AlreadyOwnedError;
        expect(err.userId).toBe('user-1');
        expect(err.itemId).toBe('item-a');
      }
    });

    it('should_leave_inventory_unchanged_when_add_fails', () => {
      const inv = new Inventory({
        userId: 'user-1',
        itemIds: ['item-a'],
      });

      try {
        inv.add('item-a');
      } catch (_) {
        // expected
      }
      expect(inv.size).toBe(1);
    });

    it('should_throw_when_itemId_is_blank', () => {
      const inv = new Inventory({ userId: 'user-1' });
      expect(() => inv.add('  ')).toThrow(/itemId/);
    });
  });
});