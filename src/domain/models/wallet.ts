/**
 * Wallet aggregate — a player's coin balance.
 *
 * One wallet per user, identity is the userId (FK to User). Balance is
 * a non-negative integer of coins; credits and debits mutate it in
 * place. debit() enforces the "no going negative" invariant: an over-
 * draft throws InsufficientBalanceError with the actual and requested
 * amounts so the caller can render a meaningful error.
 *
 * Mutation model: methods return void and change internal state, like
 * the other domain aggregates (Level, PlayerProgress). Persistence
 * happens through an outbound port (IWalletRepository); the repo
 * reads current row, calls credit/debit, writes back — the same
 * "load-mutate-save" cycle the rest of the code uses.
 */
export class Wallet {
  private readonly _userId: string;
  private _balance: number;

  constructor(params: { userId: string; balance: number }) {
    const { userId, balance } = params;
    if (typeof userId !== 'string' || !userId.trim()) {
      throw new Error('Wallet: userId must be a non-blank string');
    }
    if (!Number.isInteger(balance) || balance < 0) {
      throw new Error('Wallet: balance must be a non-negative integer');
    }
    this._userId = userId;
    this._balance = balance;
  }

  get userId(): string {
    return this._userId;
  }

  get balance(): number {
    return this._balance;
  }

  credit(amount: number): void {
    Wallet._requirePositiveInteger(amount, 'credit');
    this._balance += amount;
  }

  debit(amount: number): void {
    Wallet._requirePositiveInteger(amount, 'debit');
    if (this._balance < amount) {
      throw new InsufficientBalanceError(
        this._userId,
        this._balance,
        amount,
      );
    }
    this._balance -= amount;
  }

  private static _requirePositiveInteger(
    amount: number,
    op: 'credit' | 'debit',
  ): void {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error(
        `Wallet.${op}: amount must be a positive integer, got ${amount}`,
      );
    }
  }
}

/**
 * Thrown when Wallet.debit is called with an amount greater than the
 * current balance. Carries the actual and requested amounts so the
 * API layer can build a user-friendly message.
 */
export class InsufficientBalanceError extends Error {
  constructor(
    public readonly userId: string,
    public readonly available: number,
    public readonly requested: number,
  ) {
    super(
      `Wallet for user "${userId}" has ${available} coins but debit of ${requested} was requested`,
    );
    this.name = 'InsufficientBalanceError';
  }
}