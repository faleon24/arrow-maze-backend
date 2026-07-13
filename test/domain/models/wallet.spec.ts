import {
  InsufficientBalanceError,
  Wallet,
} from '../../../src/domain/models/wallet';

describe('Wallet', () => {
  describe('construction', () => {
    it('should_expose_userId_and_balance_when_constructed_with_valid_props', () => {
      const wallet = new Wallet({ userId: 'user-1', balance: 100 });

      expect(wallet.userId).toBe('user-1');
      expect(wallet.balance).toBe(100);
    });

    it('should_accept_zero_balance', () => {
      const wallet = new Wallet({ userId: 'user-1', balance: 0 });
      expect(wallet.balance).toBe(0);
    });

    it('should_throw_when_userId_is_blank', () => {
      expect(() => new Wallet({ userId: '  ', balance: 0 })).toThrow(
        /userId/,
      );
    });

    it('should_throw_when_balance_is_negative', () => {
      expect(
        () => new Wallet({ userId: 'user-1', balance: -1 }),
      ).toThrow(/balance/);
    });

    it('should_throw_when_balance_is_not_an_integer', () => {
      expect(
        () => new Wallet({ userId: 'user-1', balance: 1.5 }),
      ).toThrow(/balance/);
    });
  });

  describe('credit', () => {
    it('should_increase_balance_when_amount_is_positive_integer', () => {
      const wallet = new Wallet({ userId: 'user-1', balance: 50 });
      wallet.credit(25);
      expect(wallet.balance).toBe(75);
    });

    it('should_throw_when_credit_amount_is_zero_or_negative', () => {
      const wallet = new Wallet({ userId: 'user-1', balance: 50 });
      expect(() => wallet.credit(0)).toThrow(/positive integer/);
      expect(() => wallet.credit(-5)).toThrow(/positive integer/);
    });

    it('should_throw_when_credit_amount_is_not_an_integer', () => {
      const wallet = new Wallet({ userId: 'user-1', balance: 50 });
      expect(() => wallet.credit(1.5)).toThrow(/positive integer/);
    });
  });

  describe('debit', () => {
    it('should_decrease_balance_when_sufficient', () => {
      const wallet = new Wallet({ userId: 'user-1', balance: 50 });
      wallet.debit(30);
      expect(wallet.balance).toBe(20);
    });

    it('should_throw_InsufficientBalanceError_when_amount_exceeds_balance', () => {
      const wallet = new Wallet({ userId: 'user-1', balance: 10 });

      expect(() => wallet.debit(20)).toThrow(InsufficientBalanceError);
    });

    it('should_leave_balance_unchanged_when_debit_fails', () => {
      const wallet = new Wallet({ userId: 'user-1', balance: 10 });

      try {
        wallet.debit(20);
      } catch (_) {
        // expected
      }
      expect(wallet.balance).toBe(10);
    });

    it('should_expose_available_and_requested_amounts_on_error', () => {
      const wallet = new Wallet({ userId: 'user-1', balance: 10 });

      try {
        wallet.debit(20);
        fail('expected InsufficientBalanceError');
      } catch (e) {
        expect(e).toBeInstanceOf(InsufficientBalanceError);
        const err = e as InsufficientBalanceError;
        expect(err.userId).toBe('user-1');
        expect(err.available).toBe(10);
        expect(err.requested).toBe(20);
      }
    });

    it('should_throw_when_debit_amount_is_zero_or_negative', () => {
      const wallet = new Wallet({ userId: 'user-1', balance: 50 });
      expect(() => wallet.debit(0)).toThrow(/positive integer/);
      expect(() => wallet.debit(-5)).toThrow(/positive integer/);
    });
  });
});