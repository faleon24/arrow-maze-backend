import { Wallet } from '../../../../src/domain/models/wallet';
import { IWalletRepository } from '../../../../src/application/ports/out/wallet-repository.port';
import { GetWalletUseCase } from '../../../../src/application/usecases/wallet/get-wallet.usecase';

describe('GetWalletUseCase', () => {
  it('should_return_the_persisted_wallet_when_it_exists', async () => {
    const wallet = new Wallet({ userId: 'user-1', balance: 250 });
    const repo: IWalletRepository = {
      findByUser: jest.fn().mockResolvedValue(wallet),
      save: jest.fn(),
    };
    const useCase = new GetWalletUseCase(repo);

    const result = await useCase.execute('user-1');

    expect(result).toBe(wallet);
  });

  it('should_return_a_default_empty_wallet_when_none_exists', async () => {
    const repo: IWalletRepository = {
      findByUser: jest.fn().mockResolvedValue(null),
      save: jest.fn(),
    };
    const useCase = new GetWalletUseCase(repo);

    const result = await useCase.execute('user-1');

    expect(result.userId).toBe('user-1');
    expect(result.balance).toBe(0);
  });
});