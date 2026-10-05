import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { DatabaseSeeder } from '../../scripts/DatabaseSeeder.js';
import { District } from '../../src/models/District.js';
import { HazardEvent } from '../../src/models/HazardEvent.js';
import { Organisation } from '../../src/models/Organisation.js';
import { RiverBasin } from '../../src/models/RiverBasin.js';
import { User } from '../../src/models/User.js';

// `npm run seed` is run again and again against the shared cluster, so a
// second run must leave the database exactly as the first one did: the same
// records in every collection, under the same ids, so nothing that points at
// them breaks. Runs the real seeders, in their real order.

// Every collection's documents, as sorted ids - counts and identity at once.
const snapshot = async () => {
  const collections = await mongoose.connection.db.listCollections().toArray();
  const entries = await Promise.all(
    collections.map(async ({ name }) => {
      const docs = await mongoose.connection.db
        .collection(name)
        .find({}, { projection: { _id: 1 } })
        .toArray();
      return [name, docs.map((doc) => String(doc._id)).sort()];
    }),
  );
  return Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)));
};

const counts = (snap) =>
  Object.fromEntries(Object.entries(snap).map(([name, ids]) => [name, ids.length]));

beforeAll(async () => {
  // The unique indexes are what would turn a duplicate into an error.
  await Promise.all(
    [District, RiverBasin, User, Organisation, HazardEvent].map((Model) => Model.init()),
  );
});

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('DatabaseSeeder (idempotency)', () => {
  it('DMS-110: a second full seed keeps the same records, under the same ids, in every collection', async () => {
    await new DatabaseSeeder().seed();
    const first = await snapshot();

    await new DatabaseSeeder().seed();
    const second = await snapshot();

    expect(counts(second)).toEqual(counts(first));
    expect(second).toEqual(first);
  });

  it('DMS-110: seeds the demo world the README describes', async () => {
    await new DatabaseSeeder().seed();

    expect(await District.countDocuments()).toBe(25);
    expect(await RiverBasin.countDocuments()).toBe(8);
    expect(await User.countDocuments()).toBe(506);
    expect(await Organisation.countDocuments()).toBe(7);
    expect(await HazardEvent.countDocuments()).toBe(2);
  });

  it('DMS-110: --reset-demo on a seeded database ends with the same records and ids', async () => {
    await new DatabaseSeeder().seed();
    const first = await snapshot();

    await new DatabaseSeeder().seed({ resetDemo: true });

    expect(await snapshot()).toEqual(first);
  });

  it('DMS-110: --only re-runs one seeder without touching the rest', async () => {
    await new DatabaseSeeder().seed();
    const first = await snapshot();

    await new DatabaseSeeder().seed({ only: ['hazard-event'] });

    expect(await snapshot()).toEqual(first);
  });
});
