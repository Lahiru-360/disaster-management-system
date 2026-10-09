import mongoose from 'mongoose';
import { SupplyType } from '../../../src/enums/SupplyType.js';
import { TeamStatus } from '../../../src/enums/TeamStatus.js';
import { ReliefStock } from '../../../src/models/ReliefStock.js';
import { RescueTeam } from '../../../src/models/RescueTeam.js';
import { Shelter } from '../../../src/models/Shelter.js';

const GAMPAHA = new mongoose.Types.ObjectId();
const COLOMBO = new mongoose.Types.ObjectId();
const RED_CROSS = new mongoose.Types.ObjectId();
const SL_ARMY = new mongoose.Types.ObjectId();
const LEAD = new mongoose.Types.ObjectId();

const shelter = (fields = {}) =>
  new Shelter({
    district: GAMPAHA,
    name: 'Gampaha Central College',
    location: { lat: 7.0912, lng: 79.9948 },
    capacity: 500,
    ...fields,
  });

const camp = { lat: 7.0873, lng: 80.0144, label: 'Gampaha Army Camp' };

const team = (fields = {}) =>
  new RescueTeam({
    name: 'Team Alpha',
    organisation: SL_ARMY,
    district: GAMPAHA,
    memberCount: 8,
    baseLocation: camp,
    currentLocation: camp,
    ...fields,
  });

const stock = (fields = {}) =>
  new ReliefStock({
    organisation: RED_CROSS,
    district: GAMPAHA,
    supplyType: SupplyType.WATER,
    unit: 'bottles',
    quantityAvailable: 1200,
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
  await Shelter.init();
  await RescueTeam.init();
  await ReliefStock.init();
});

describe('Shelter model', () => {
  it('Main 1-2: accepts a shelter and starts it empty', async () => {
    const doc = shelter();

    expect(await errorsOf(doc)).toEqual({});
    expect(doc.currentOccupancy).toBe(0);
    expect(doc.location.label).toBeNull();
  });

  it('Main 1-2: requires district, name, location and capacity', async () => {
    const errors = await errorsOf(new Shelter({}));

    expect(Object.keys(errors).sort()).toEqual([
      'capacity',
      'district',
      'location.lat',
      'location.lng',
      'name',
    ]);
  });

  it.each([0, -5])('A1: refuses a capacity of %d', async (capacity) => {
    expect(Object.keys(await errorsOf(shelter({ capacity })))).toEqual(['capacity']);
  });

  it('A1: refuses a capacity that is not a whole number', async () => {
    expect(await errorsOf(shelter({ capacity: 10.5 }))).toEqual({
      capacity: 'must be a whole number',
    });
  });

  it('E1: refuses a negative or fractional occupancy', async () => {
    expect(Object.keys(await errorsOf(shelter({ currentOccupancy: -1 })))).toEqual([
      'currentOccupancy',
    ]);
    expect(await errorsOf(shelter({ currentOccupancy: 12.5 }))).toEqual({
      currentOccupancy: 'must be a whole number',
    });
  });

  it('Main 5: allows an occupancy above capacity', async () => {
    expect(await errorsOf(shelter({ currentOccupancy: 505 }))).toEqual({});
  });

  it('Main 1-2: refuses a location off the globe', async () => {
    const errors = await errorsOf(shelter({ location: { lat: 91, lng: -181 } }));

    expect(Object.keys(errors).sort()).toEqual(['location.lat', 'location.lng']);
  });

  it('A1: refuses a second shelter with the same name in the same district', async () => {
    await shelter().save();

    await expect(shelter().save()).rejects.toMatchObject({ code: 11000 });
  });

  it('A1: allows the same name in another district', async () => {
    await shelter().save();

    await expect(shelter({ district: COLOMBO }).save()).resolves.toBeDefined();
  });

  it('Main 1-2: serialises with id and without _id or __v', () => {
    const json = shelter().toJSON();

    expect(json.id).toBeDefined();
    expect(json).not.toHaveProperty('_id');
    expect(json).not.toHaveProperty('__v');
  });
});

describe('RescueTeam model', () => {
  it('Main 7: accepts a team and starts it AVAILABLE with no lead', async () => {
    const doc = team();

    expect(await errorsOf(doc)).toEqual({});
    expect(doc.status).toBe(TeamStatus.AVAILABLE);
    expect(doc.lead).toBeNull();
  });

  it('Main 7: requires name, organisation, district, member count and both locations', async () => {
    const errors = await errorsOf(new RescueTeam({}));

    expect(Object.keys(errors).sort()).toEqual([
      'baseLocation.lat',
      'baseLocation.lng',
      'currentLocation.lat',
      'currentLocation.lng',
      'district',
      'memberCount',
      'name',
      'organisation',
    ]);
  });

  it('Main 7: refuses a status outside TeamStatus', async () => {
    expect(Object.keys(await errorsOf(team({ status: 'BUSY' })))).toEqual(['status']);
  });

  it('Main 7: refuses a member count of 0 or a fraction', async () => {
    expect(Object.keys(await errorsOf(team({ memberCount: 0 })))).toEqual(['memberCount']);
    expect(await errorsOf(team({ memberCount: 2.5 }))).toEqual({
      memberCount: 'must be a whole number',
    });
  });

  it('Main 7: refuses a second team with the same name in the same district', async () => {
    await team().save();

    await expect(team({ organisation: RED_CROSS }).save()).rejects.toMatchObject({ code: 11000 });
  });

  it('Main 10: refuses a lead who already leads another team', async () => {
    await team({ lead: LEAD }).save();

    await expect(team({ name: 'Team Echo', lead: LEAD }).save()).rejects.toMatchObject({
      code: 11000,
    });
  });

  it('Main 7: serialises with id and without _id or __v', () => {
    const json = team().toJSON();

    expect(json.id).toBeDefined();
    expect(json).not.toHaveProperty('_id');
    expect(json).not.toHaveProperty('__v');
  });

  it('Main 7: allows several teams without a lead', async () => {
    await team().save();

    await expect(team({ name: 'Team Echo' }).save()).resolves.toBeDefined();
  });
});

describe('ReliefStock model', () => {
  it('Main 12: accepts a stock row', async () => {
    expect(await errorsOf(stock())).toEqual({});
  });

  it('Main 12: requires organisation, district, supply type, unit and quantity', async () => {
    const errors = await errorsOf(new ReliefStock({}));

    expect(Object.keys(errors).sort()).toEqual([
      'district',
      'organisation',
      'quantityAvailable',
      'supplyType',
      'unit',
    ]);
  });

  it('Main 12: refuses a supply type outside SupplyType', async () => {
    expect(Object.keys(await errorsOf(stock({ supplyType: 'FUEL' })))).toEqual(['supplyType']);
  });

  it('E5: refuses a negative or fractional quantity, and allows 0', async () => {
    expect(Object.keys(await errorsOf(stock({ quantityAvailable: -1 })))).toEqual([
      'quantityAvailable',
    ]);
    expect(await errorsOf(stock({ quantityAvailable: 2.5 }))).toEqual({
      quantityAvailable: 'must be a whole number',
    });
    expect(await errorsOf(stock({ quantityAvailable: 0 }))).toEqual({});
  });

  it('Main 12: serialises with id and without _id or __v', () => {
    const json = stock().toJSON();

    expect(json.id).toBeDefined();
    expect(json).not.toHaveProperty('_id');
    expect(json).not.toHaveProperty('__v');
  });

  it('Main 12: keeps one row per organisation, district and supply type', async () => {
    await stock().save();

    await expect(stock({ quantityAvailable: 5 }).save()).rejects.toMatchObject({ code: 11000 });
    await expect(
      stock({ supplyType: SupplyType.FOOD, unit: 'packs' }).save(),
    ).resolves.toBeDefined();
    await expect(stock({ organisation: SL_ARMY }).save()).resolves.toBeDefined();
  });
});
