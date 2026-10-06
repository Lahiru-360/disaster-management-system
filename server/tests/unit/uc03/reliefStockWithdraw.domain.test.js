import { InsufficientStockError } from '../../../src/domain/coordination/InsufficientStockError.js';
import { ReliefStock } from '../../../src/domain/coordination/ReliefStock.js';
import { SupplyType } from '../../../src/enums/SupplyType.js';

const stock = (quantityAvailable = 1200) =>
  new ReliefStock({
    stockId: '66fb0d1b2c3d4e5f6a7b8f01',
    supplyType: SupplyType.WATER,
    unit: 'bottles',
    quantityAvailable,
  });

const errorOf = (fn) => {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('expected an error');
};

describe('ReliefStock.withdraw', () => {
  it('TC-25: Main 13 reduces the stock by the quantity', () => {
    const built = stock();

    built.withdraw(500);

    expect(built.quantityAvailable).toBe(700);
  });

  it('TC-26: Main 13 a quantity equal to everything available is allowed, leaving 0', () => {
    const built = stock();

    built.withdraw(1200);

    expect(built.quantityAvailable).toBe(0);
  });

  it.each([
    ['TC-59', 0],
    ['TC-60', -1],
    ['TC-60', 2.5],
    ['TC-61', 1201],
    ['E5', '5'],
    ['E5', undefined],
  ])(
    '%s: E5 refuses %p, showing what is available, and leaves the stock (TC-62)',
    (_tc, quantity) => {
      const built = stock();

      const error = errorOf(() => built.withdraw(quantity));

      expect(error).toBeInstanceOf(InsufficientStockError);
      expect(error).toMatchObject({
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed.',
        errors: [{ field: 'quantity', message: 'must be between 1 and 1200 (available)' }],
        available: 1200,
      });
      expect(built.quantityAvailable).toBe(1200);
    },
  );

  it('E5: an empty stock row says no stock is available, in its unit', () => {
    const error = errorOf(() => stock(0).withdraw(1));

    expect(error.errors).toEqual([
      { field: 'quantity', message: 'no stock available (0 bottles)' },
    ]);
  });

  it('E5: the message follows what is left after earlier withdrawals', () => {
    const built = stock();
    built.withdraw(1100);

    expect(errorOf(() => built.withdraw(101)).errors[0].message).toBe(
      'must be between 1 and 100 (available)',
    );
  });
});
