import { jest } from '@jest/globals';
import { EventStatus } from '../../../src/enums/EventStatus.js';
import { OrgType } from '../../../src/enums/OrgType.js';
import { Role } from '../../../src/enums/Role.js';
import { SupplyType } from '../../../src/enums/SupplyType.js';
import { HazardEvent } from '../../../src/models/HazardEvent.js';
import { Organisation } from '../../../src/models/Organisation.js';
import { ReliefStock } from '../../../src/models/ReliefStock.js';
import { Shelter } from '../../../src/models/Shelter.js';
import { SupplyDistribution } from '../../../src/models/SupplyDistribution.js';
import { SupplyService } from '../../../src/services/SupplyService.js';
import { seedAreas } from '../../helpers/areaFixtures.js';
import { FakeClock } from '../../helpers/FakeClock.js';
import { createUser } from '../../helpers/userFactory.js';

const NOW = '2026-10-03T10:15:00.000Z';

let areas;
let officer;
let redCross;
let army;
let water;
let food;
let medicine;
let shelter;
let service;

beforeEach(async () => {
  areas = await seedAreas();
  await HazardEvent.create({
    name: 'Flood – Gampaha District',
    hazardType: 'FLOOD',
    status: EventStatus.ACTIVE,
    startDate: new Date('2026-09-25T00:00:00.000Z'),
    districts: [areas.gampaha._id],
  });
  officer = await createUser({
    role: Role.DISTRICT_OFFICER,
    district: areas.gampaha,
    name: 'Dilani W',
  });
  redCross = await Organisation.create({ name: 'Red Cross Sri Lanka', type: OrgType.NGO });
  army = await Organisation.create({ name: 'SL Army', type: OrgType.ARMED_FORCES });
  const row = (organisation, supplyType, unit, quantityAvailable, district = areas.gampaha._id) =>
    ReliefStock.create({ organisation, district, supplyType, unit, quantityAvailable });
  water = await row(redCross._id, SupplyType.WATER, 'bottles', 1200);
  food = await row(redCross._id, SupplyType.FOOD, 'packs', 0);
  medicine = await row(army._id, SupplyType.MEDICINE, 'units', 150);
  await row(redCross._id, SupplyType.WATER, 'bottles', 999, areas.colombo._id);
  shelter = await Shelter.create({
    district: areas.gampaha._id,
    name: 'Gampaha Central College',
    location: { lat: 7.09, lng: 79.99 },
    capacity: 500,
  });
  service = new SupplyService({ clock: new FakeClock(NOW) });
});

const log = (quantity, fields = {}) =>
  service.logDistribution(officer, {
    shelterId: shelter.id,
    stockId: water.id,
    quantity,
    ...fields,
  });

describe('SupplyService.listStock', () => {
  it("Main 12: lists the district's stock by organisation then type, empty rows included", async () => {
    const stock = await service.listStock(officer);

    expect(stock.map((s) => [s.organisation.name, s.supplyType, s.quantityAvailable])).toEqual([
      ['Red Cross Sri Lanka', SupplyType.FOOD, 0],
      ['Red Cross Sri Lanka', SupplyType.WATER, 1200],
      ['SL Army', SupplyType.MEDICINE, 150],
    ]);
    expect(stock[1]).toMatchObject({
      id: water.id,
      organisation: { id: redCross.id, name: 'Red Cross Sri Lanka', type: OrgType.NGO },
      district: { id: areas.gampaha.id, name: 'Gampaha' },
      unit: 'bottles',
    });
  });

  it('Main 12: narrows to one organisation and one supply type', async () => {
    const stock = await service.listStock(officer, {
      organisationId: redCross.id,
      supplyType: SupplyType.WATER,
    });

    expect(stock.map((s) => s.id)).toEqual([water.id]);
  });

  it('TC-02: a district officer asking for another district is 403', async () => {
    await expect(
      service.listStock(officer, { districtId: areas.colombo.id }),
    ).rejects.toMatchObject({
      status: 403,
    });
  });
});

describe('SupplyService.logDistribution', () => {
  it('TC-25: Main 13 records the distribution and reduces the stock by the quantity', async () => {
    const result = await log(500);

    expect(result.stock).toMatchObject({ id: water.id, quantityAvailable: 700 });
    expect(result.distribution).toMatchObject({
      shelter: { id: shelter.id, name: 'Gampaha Central College' },
      stockId: water.id,
      quantity: 500,
      unit: 'bottles',
      distributedAt: new Date(NOW),
      loggedBy: { id: officer.id, name: 'Dilani W' },
    });
    expect((await ReliefStock.findById(water._id)).quantityAvailable).toBe(700);
    expect(await SupplyDistribution.countDocuments()).toBe(1);
  });

  it('TC-26: Main 13 a quantity equal to the stock is allowed and leaves 0', async () => {
    const result = await log(1200);

    expect(result.stock.quantityAvailable).toBe(0);
  });

  it('TC-27: Main 13 copies the organisation, supply type and district for UC04', async () => {
    await log(10);

    const [record] = await SupplyDistribution.find();
    expect(String(record.organisation)).toBe(redCross.id);
    expect(record.supplyType).toBe(SupplyType.WATER);
    expect(String(record.district)).toBe(areas.gampaha.id);
  });

  it('TC-28: Main 13 two concurrent logs exceeding the stock - one wins, one 400, never negative', async () => {
    const results = await Promise.allSettled([log(800), log(800)]);

    const rejected = results.filter((r) => r.status === 'rejected');
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      errors: [{ field: 'quantity', message: 'must be between 1 and 400 (available)' }],
    });
    expect((await ReliefStock.findById(water._id)).quantityAvailable).toBe(400);
    expect(await SupplyDistribution.countDocuments()).toBe(1);
  });

  it.each([0, -1, 2.5, 1201])(
    'TC-62: E5 a quantity of %p is refused; the stock is unchanged and nothing recorded',
    async (quantity) => {
      await expect(log(quantity)).rejects.toMatchObject({
        status: 400,
        errors: [{ field: 'quantity', message: 'must be between 1 and 1200 (available)' }],
      });
      expect((await ReliefStock.findById(water._id)).quantityAvailable).toBe(1200);
      expect(await SupplyDistribution.countDocuments()).toBe(0);
    },
  );

  it('E5: an empty stock row says so', async () => {
    await expect(log(1, { stockId: food.id })).rejects.toMatchObject({
      errors: [{ field: 'quantity', message: 'no stock available (0 packs)' }],
    });
  });

  it('TC-29: Main 13 a shelter in another district is 403', async () => {
    const colomboShelter = await Shelter.create({
      district: areas.colombo._id,
      name: 'Colombo Hall',
      location: { lat: 6.93, lng: 79.85 },
      capacity: 100,
    });

    await expect(log(5, { shelterId: colomboShelter.id })).rejects.toMatchObject({ status: 403 });
    expect((await ReliefStock.findById(water._id)).quantityAvailable).toBe(1200);
  });

  it('TC-29: Main 13 stock from another district is 403', async () => {
    const colomboStock = await ReliefStock.findOne({ district: areas.colombo._id });

    await expect(log(5, { stockId: colomboStock.id })).rejects.toMatchObject({ status: 403 });
  });

  it('Main 13: no ACTIVE incident is 409 and nothing changes', async () => {
    await HazardEvent.deleteMany({});

    await expect(log(5)).rejects.toMatchObject({ status: 409, code: 'NO_ACTIVE_INCIDENT' });
    expect((await ReliefStock.findById(water._id)).quantityAvailable).toBe(1200);
  });

  it('Main 12: an unknown or malformed stock or shelter id is 404', async () => {
    await expect(log(5, { stockId: '66fb0d1b2c3d4e5f6a7b8f99' })).rejects.toMatchObject({
      status: 404,
      message: 'Relief stock not found.',
    });
    await expect(log(5, { shelterId: 'nope' })).rejects.toMatchObject({
      status: 404,
      message: 'Shelter not found.',
    });
  });

  it('Main 13: if the distribution cannot be recorded the quantity goes back into the stock', async () => {
    service = new SupplyService({
      clock: new FakeClock(NOW),
      distributionModel: { create: jest.fn().mockRejectedValue(new Error('write failed')) },
    });

    await expect(log(500)).rejects.toThrow('write failed');
    expect((await ReliefStock.findById(water._id)).quantityAvailable).toBe(1200);
  });

  it("Main 13: medicine from another organisation's stock is attributed to it", async () => {
    const result = await log(50, { stockId: medicine.id });

    expect(result.distribution.organisation).toEqual({
      id: army.id,
      name: 'SL Army',
      type: OrgType.ARMED_FORCES,
    });
    expect(result.stock.quantityAvailable).toBe(100);
  });
});
