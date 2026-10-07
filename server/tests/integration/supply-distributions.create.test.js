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
import { seedAreas } from '../helpers/areaFixtures.js';
import { bearerFor } from '../helpers/authHelper.js';
import { createUser } from '../helpers/userFactory.js';

let areas;
let officer;
let redCross;
let water;
let shelter;

beforeEach(async () => {
  areas = await seedAreas();
  await HazardEvent.create({
    name: 'Flood – Gampaha District',
    hazardType: 'FLOOD',
    status: EventStatus.ACTIVE,
    startDate: new Date('2026-09-25T00:00:00.000Z'),
    districts: [areas.gampaha._id],
  });
  officer = await createUser({ role: Role.DISTRICT_OFFICER, district: areas.gampaha });
  redCross = await Organisation.create({ name: 'Red Cross Sri Lanka', type: OrgType.NGO });
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

const as = (user) => ({
  get: (path) => request(app).get(path).set('Authorization', bearerFor(user)),
  post: (path, body) => request(app).post(path).set('Authorization', bearerFor(user)).send(body),
});

const log = (body, user = officer) =>
  as(user).post('/api/supply-distributions', {
    shelterId: shelter.id,
    stockId: water.id,
    quantity: 500,
    ...body,
  });

describe('GET /api/relief-stock', () => {
  it("Main 12: lists the district's stock with its owner organisation", async () => {
    const res = await as(officer).get('/api/relief-stock');

    expect(res.status).toBe(200);
    expect(res.body.data.stock).toEqual([
      {
        id: water.id,
        organisation: { id: redCross.id, name: 'Red Cross Sri Lanka', type: 'NGO' },
        district: { id: areas.gampaha.id, name: 'Gampaha' },
        supplyType: 'WATER',
        unit: 'bottles',
        quantityAvailable: 1200,
        updatedAt: expect.any(String),
      },
    ]);
  });

  it('Main 12: a DMC officer names the district; an unknown supply type is 400', async () => {
    const dmc = await createUser({ role: Role.DMC_OFFICER });

    const ok = await as(dmc).get(
      `/api/relief-stock?districtId=${areas.gampaha.id}&supplyType=WATER`,
    );
    const bad = await as(dmc).get(
      `/api/relief-stock?districtId=${areas.gampaha.id}&supplyType=FUEL`,
    );

    expect(ok.body.data.stock).toHaveLength(1);
    expect(bad.status).toBe(400);
    expect(bad.body.error.errors.map((e) => e.field)).toEqual(['supplyType']);
  });

  it('Main 12: a rescue team lead gets 403', async () => {
    const lead = await createUser({ role: Role.RESCUE_TEAM_LEAD });

    expect((await as(lead).get('/api/relief-stock')).status).toBe(403);
  });
});

describe('POST /api/supply-distributions', () => {
  it('TC-25: Main 13 records the distribution and reduces the stock', async () => {
    const res = await log({});

    expect(res.status).toBe(201);
    expect(res.body.data.distribution).toMatchObject({
      shelter: { id: shelter.id, name: 'Gampaha Central College' },
      stockId: water.id,
      organisation: { name: 'Red Cross Sri Lanka' },
      supplyType: 'WATER',
      unit: 'bottles',
      quantity: 500,
      loggedBy: { id: officer.id },
    });
    expect(res.body.data.stock.quantityAvailable).toBe(700);
    expect((await ReliefStock.findById(water._id)).quantityAvailable).toBe(700);
  });

  it('TC-26: Main 13 the whole stock can go at once, leaving 0', async () => {
    const res = await log({ quantity: 1200 });

    expect(res.status).toBe(201);
    expect(res.body.data.stock.quantityAvailable).toBe(0);
  });

  it('TC-27: Main 13 the stored distribution carries the organisation, type and district', async () => {
    await log({ quantity: 20 });

    const [record] = await SupplyDistribution.find();
    expect(String(record.organisation)).toBe(redCross.id);
    expect(record.supplyType).toBe('WATER');
    expect(String(record.district)).toBe(areas.gampaha.id);
  });

  it('TC-28: Main 13 two concurrent logs exceeding the stock - one 201, one 400, never negative', async () => {
    const [a, b] = await Promise.all([log({ quantity: 700 }), log({ quantity: 700 })]);

    expect([a.status, b.status].sort()).toEqual([201, 400]);
    const lost = a.status === 400 ? a : b;
    expect(lost.body.error.errors).toEqual([
      { field: 'quantity', message: 'must be between 1 and 500 (available)' },
    ]);
    expect((await ReliefStock.findById(water._id)).quantityAvailable).toBe(500);
    expect(await SupplyDistribution.countDocuments()).toBe(1);
  });

  it('TC-29: Main 13 logging to a shelter in another district is 403', async () => {
    const other = await Shelter.create({
      district: areas.colombo._id,
      name: 'Colombo Hall',
      location: { lat: 6.93, lng: 79.85 },
      capacity: 100,
    });

    const res = await log({ shelterId: other.id });

    expect(res.status).toBe(403);
    expect((await ReliefStock.findById(water._id)).quantityAvailable).toBe(1200);
  });

  it('Main 12: missing or malformed ids are 400; a DMC officer may not log (403)', async () => {
    const bad = await as(officer).post('/api/supply-distributions', { quantity: 5 });
    const dmc = await createUser({ role: Role.DMC_OFFICER });

    expect(bad.status).toBe(400);
    expect(bad.body.error.errors.map((e) => e.field).sort()).toEqual(['shelterId', 'stockId']);
    expect((await log({}, dmc)).status).toBe(403);
  });

  it('Main 13: no ACTIVE incident is 409 NO_ACTIVE_INCIDENT', async () => {
    await HazardEvent.deleteMany({});

    expect((await log({})).body.error.code).toBe('NO_ACTIVE_INCIDENT');
  });
});
