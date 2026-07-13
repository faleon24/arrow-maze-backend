import { ShopItem } from '../../../../src/domain/models/shop-item';
import { IShopRepository } from '../../../../src/application/ports/out/shop-repository.port';
import { ListShopItemsUseCase } from '../../../../src/application/usecases/shop/list-shop-items.usecase';

describe('ListShopItemsUseCase', () => {
  it('should_return_the_full_catalog_from_the_repository', async () => {
    const items = [
      new ShopItem({
        id: 'a',
        name: 'Alpha',
        costCoins: 10,
        kind: 'COSMETIC',
      }),
      new ShopItem({
        id: 'b',
        name: 'Beta',
        costCoins: 20,
        kind: 'POWERUP',
      }),
    ];
    const repo: IShopRepository = {
      findAll: jest.fn().mockResolvedValue(items),
      findById: jest.fn(),
    };
    const useCase = new ListShopItemsUseCase(repo);

    const result = await useCase.execute();

    expect(result).toBe(items);
    expect(repo.findAll).toHaveBeenCalledTimes(1);
  });
});