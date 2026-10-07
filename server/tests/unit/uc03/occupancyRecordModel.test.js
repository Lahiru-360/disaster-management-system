import mongoose from 'mongoose';
import { OccupancyRecord } from '../../../src/models/OccupancyRecord.js';

const record = (fields = {}) =>
  new OccupancyRecord({
    shelter: new mongoose.Types.ObjectId(),
    district: new mongoose.Types.ObjectId(),
    occupants: 460,
    capacity: 500,
    recordedAt: new Date('2026-10-03T09:30:00.000Z'),
    recordedBy: new mongoose.Types.ObjectId(),
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
  await OccupancyRecord.init();
});

describe('OccupancyRecord model', () => {
  it('Main 4: accepts a record', async () => {
    expect(await errorsOf(record())).toEqual({});
  });

  it('TC-14: accepts 0 occupants', async () => {
    expect(await errorsOf(record({ occupants: 0 }))).toEqual({});
  });

  it('Main 5: accepts occupants above capacity', async () => {
    expect(await errorsOf(record({ occupants: 505 }))).toEqual({});
  });

  it('Main 4: requires every field', async () => {
    const errors = await errorsOf(new OccupancyRecord({}));

    expect(Object.keys(errors).sort()).toEqual([
      'capacity',
      'district',
      'occupants',
      'recordedAt',
      'recordedBy',
      'shelter',
    ]);
  });

  it('E1: refuses negative or fractional occupants', async () => {
    expect(Object.keys(await errorsOf(record({ occupants: -1 })))).toEqual(['occupants']);
    expect(await errorsOf(record({ occupants: 12.5 }))).toEqual({
      occupants: 'must be a whole number',
    });
  });

  it('Main 4: refuses a capacity below 1 or fractional', async () => {
    expect(Object.keys(await errorsOf(record({ capacity: 0 })))).toEqual(['capacity']);
    expect(await errorsOf(record({ capacity: 10.5 }))).toEqual({
      capacity: 'must be a whole number',
    });
  });

  it('Main 4: has no createdAt or updatedAt, only recordedAt', async () => {
    const saved = await record().save();

    expect(saved.createdAt).toBeUndefined();
    expect(saved.updatedAt).toBeUndefined();
    expect(saved.recordedAt).toEqual(new Date('2026-10-03T09:30:00.000Z'));
  });

  it('Main 4: indexes history by shelter and by district, each in time order', async () => {
    const keys = (await OccupancyRecord.listIndexes()).map((index) => index.key);

    expect(keys).toEqual(
      expect.arrayContaining([
        { shelter: 1, recordedAt: 1 },
        { district: 1, recordedAt: 1 },
      ]),
    );
  });

  it('Main 4: serialises with id and without _id or __v', () => {
    const json = record().toJSON();

    expect(json.id).toBeDefined();
    expect(json).not.toHaveProperty('_id');
    expect(json).not.toHaveProperty('__v');
  });
});
