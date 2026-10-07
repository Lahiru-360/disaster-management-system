import request from 'supertest';
import { app } from '../../src/core/App.js';
import { EventStatus } from '../../src/enums/EventStatus.js';
import { OrgType } from '../../src/enums/OrgType.js';
import { Role } from '../../src/enums/Role.js';
import { HazardEvent } from '../../src/models/HazardEvent.js';
import { Organisation } from '../../src/models/Organisation.js';
import { ReliefStock } from '../../src/models/ReliefStock.js';
import { Shelter } from '../../src/models/Shelter.js';
import { SupplyDistribution } from '../../src/models/SupplyDistribution.js';
import { SupplyService } from '../../src/services/SupplyService.js';
import { seedAreas } from '../helpers/areaFixtures.js';
import { bearerFor } from '../helpers/authHelper.js';
import { createUser } from '../helpers/userFactory.js';

// UC03 E5 (DMS-151): too much, or 0 or less, is refused with the available
// quantity shown, and nothing changes.
let officer;
let water;
let shelter;

beforeEach(async () => {
  const areas = await seedAreas();
  await HazardEvent.create({
    name: 'Flood – Gampaha District',
    hazardType: 'FLOOD',
    status: EventStatus.ACTIVE,
    startDate: new Date('2026-09-25T00:00:00.000Z'),
    districts: [areas.gampaha._id],
  });
  officer = await createUser({ role: Role.DISTRICT_OFFICER, district: areas.gampaha });
  const redCross = await Organisation.create({ name: 'Red Cross Sri Lanka', type: OrgType.NGO });
  water = await ReliefStock.create({
    organisation: redCross._id,
    district: areas.gampaha._id,
    supplyType: 'WATER',
    unit: 'bottles',
    quantityAvailable: 1200,
  });
  shelter = await Shelter.create({
    district: areas.gampaha._id,
    name: 'Gampaha Central College',
    location: { lat: 7.09, lng: 79.99 },
    capacity: 500,
  });
});

const log = (quantity) =>
  request(app)
    .post('/api/supply-distributions')
    .set('Authorization', bearerFor(officer))
    .send({ shelterId: shelter.id, stockId: water.id, quantity });

const unchanged = async () => {
  expect((await ReliefStock.findById(water._id)).quantityAvailable).toBe(1200);
  expect(await SupplyDistribution.countDocuments()).toBe(0);
};

describe('POST /api/supply-distributions with an impossible quantity (E5)', () => {
  it.each([
    ['TC-59', 0],
    ['TC-60', -1],
    ['TC-60', 2.5],
    ['TC-61', 1201],
  ])('%s: quantity %p is 400 on quantity, showing the 1200 available', async (_tc, quantity) => {
    const res = await log(quantity);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed.',
        errors: [{ field: 'quantity', message: 'must be between 1 and 1200 (available)' }],
      },
    });
  });

  it.each([0, -1, 2.5, 1201])(
    'TC-62: after quantity %p the stock and the log are unchanged',
    async (quantity) => {
      await log(quantity);

      await unchanged();
    },
  );

  it('E5: a quantity that is not a number is 400 on quantity too', async () => {
    const res = await log('500');

    expect(res.status).toBe(400);
    expect(res.body.error.errors.map((e) => e.field)).toEqual(['quantity']);
    await unchanged();
  });

  it('E5: once the stock is used up, any quantity is refused with "no stock available"', async () => {
    await log(1200);

    const res = await log(1);

    expect(res.status).toBe(400);
    expect(res.body.error.errors).toEqual([
      { field: 'quantity', message: 'no stock available (0 bottles)' },
    ]);
  });
});

describe('SupplyService when another log drains the stock first (E5)', () => {
  it('TC-63: the guard fails and the 400 shows the recalculated available quantity', async () => {
    // The stock as read was 1200, but by the time the guarded update runs a
    // colleague has taken 1000 - only 200 are left.
    const drainingModel = {
      findById: (id) => ReliefStock.findById(id),
      async findOneAndUpdate(filter, update, options) {
        await ReliefStock.updateOne({ _id: water._id }, { $inc: { quantityAvailable: -1000 } });
        return ReliefStock.findOneAndUpdate(filter, update, options);
      },
      updateOne: (...args) => ReliefStock.updateOne(...args),
    };
    const service = new SupplyService({ stockModel: drainingModel });

    await expect(
      service.logDistribution(officer, { shelterId: shelter.id, stockId: water.id, quantity: 500 }),
    ).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      errors: [{ field: 'quantity', message: 'must be between 1 and 200 (available)' }],
    });
    expect((await ReliefStock.findById(water._id)).quantityAvailable).toBe(200);
    expect(await SupplyDistribution.countDocuments()).toBe(0);
  });
});
