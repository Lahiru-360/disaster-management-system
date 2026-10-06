import mongoose from 'mongoose';
import { SupplyType } from '../../../src/enums/SupplyType.js';
import { SupplyDistribution } from '../../../src/models/SupplyDistribution.js';

const distribution = (fields = {}) =>
  new SupplyDistribution({
    shelter: new mongoose.Types.ObjectId(),
    stock: new mongoose.Types.ObjectId(),
    organisation: new mongoose.Types.ObjectId(),
    supplyType: SupplyType.WATER,
    district: new mongoose.Types.ObjectId(),
    quantity: 500,
    distributedAt: new Date('2026-10-03T10:15:00.000Z'),
    loggedBy: new mongoose.Types.ObjectId(),
    ...fields,
  });

// The messages Mongoose collected, by path, or {} when the document is valid.
const errorsOf = async (doc) => {
  try {
    await doc.validate();
    return {};
  } catch (err) {
    return Object.fromEntries(Object.entries(err.errors).map(([path, e]) => [path, e.message]));
  }
};

beforeAll(async () => {
  await SupplyDistribution.init();
});

describe('SupplyDistribution model', () => {
  it('Main 13: accepts a distribution', async () => {
    expect(await errorsOf(distribution())).toEqual({});
  });

  it('TC-27: requires the shelter, stock, copied organisation, type and district, and who logged it', async () => {
    const errors = await errorsOf(new SupplyDistribution({}));

    expect(Object.keys(errors).sort()).toEqual([
      'distributedAt',
      'district',
      'loggedBy',
      'organisation',
      'quantity',
      'shelter',
      'stock',
      'supplyType',
    ]);
  });

  it.each([0, -1])('E5: refuses a quantity of %d', async (quantity) => {
    expect(Object.keys(await errorsOf(distribution({ quantity })))).toEqual(['quantity']);
  });

  it('E5: refuses a fractional quantity', async () => {
    expect(await errorsOf(distribution({ quantity: 2.5 }))).toEqual({
      quantity: 'must be a whole number',
    });
  });

  it('Main 13: refuses a supply type outside SupplyType', async () => {
    expect(Object.keys(await errorsOf(distribution({ supplyType: 'FUEL' })))).toEqual([
      'supplyType',
    ]);
  });

  it('Main 13: has no createdAt or updatedAt, only distributedAt', async () => {
    const saved = await distribution().save();

    expect(saved.createdAt).toBeUndefined();
    expect(saved.updatedAt).toBeUndefined();
    expect(saved.distributedAt).toEqual(new Date('2026-10-03T10:15:00.000Z'));
  });

  it('TC-27: indexes distributions by district in time order and by organisation', async () => {
    const keys = (await SupplyDistribution.listIndexes()).map((index) => index.key);

    expect(keys).toEqual(
      expect.arrayContaining([{ district: 1, distributedAt: 1 }, { organisation: 1 }]),
    );
  });

  it('Main 13: serialises with id and without _id or __v', () => {
    const json = distribution().toJSON();

    expect(json.id).toBeDefined();
    expect(json).not.toHaveProperty('_id');
    expect(json).not.toHaveProperty('__v');
  });
});
