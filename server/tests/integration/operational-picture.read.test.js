import request from 'supertest';
import { app } from '../../src/core/App.js';
import { EventStatus } from '../../src/enums/EventStatus.js';
import { OrgType } from '../../src/enums/OrgType.js';
import { Role } from '../../src/enums/Role.js';
import { SupplyType } from '../../src/enums/SupplyType.js';
import { HazardEvent } from '../../src/models/HazardEvent.js';
import { Organisation } from '../../src/models/Organisation.js';
import { ReliefStock } from '../../src/models/ReliefStock.js';
import { RescueTeam } from '../../src/models/RescueTeam.js';
import { Shelter } from '../../src/models/Shelter.js';
import { SupplyDistribution } from '../../src/models/SupplyDistribution.js';
import { seedAreas } from '../helpers/areaFixtures.js';
import { bearerFor, expiredBearerFor } from '../helpers/authHelper.js';
import { createUser } from '../helpers/userFactory.js';

const camp = { lat: 7.0873, lng: 80.0144 };

let areas;
let officer;
let dmc;
let army;
let redCross;

beforeEach(async () => {
  areas = await seedAreas();
  officer = await createUser({ role: Role.DISTRICT_OFFICER, district: areas.gampaha });
  dmc = await createUser({ role: Role.DMC_OFFICER });
  army = await Organisation.create({ name: 'SL Army', type: OrgType.ARMED_FORCES });
  redCross = await Organisation.create({ name: 'Red Cross Sri Lanka', type: OrgType.NGO });

  await HazardEvent.create({
    name: 'Flood – Gampaha District',
    hazardType: 'FLOOD',
    status: EventStatus.ACTIVE,
    startDate: new Date('2026-09-25T00:00:00.000Z'),
    districts: [areas.gampaha._id],
  });

  const central = await Shelter.create({
    district: areas.gampaha._id,
    name: 'Gampaha Central College',
    location: { lat: 7.09, lng: 79.99 },
    capacity: 500,
    currentOccupancy: 460,
  });
  await Shelter.create({
    district: areas.colombo._id,
    name: 'Colombo Hall',
    location: { lat: 6.93, lng: 79.85 },
    capacity: 100,
    currentOccupancy: 10,
  });

  await RescueTeam.create({
    name: 'Team Alpha',
    organisation: army._id,
    district: areas.gampaha._id,
    memberCount: 8,
    baseLocation: camp,
    currentLocation: camp,
  });
  await RescueTeam.create({
    name: 'Team Bravo',
    organisation: army._id,
    district: areas.colombo._id,
    memberCount: 5,
    baseLocation: camp,
    currentLocation: camp,
  });

  const water = await ReliefStock.create({
    organisation: redCross._id,
    district: areas.gampaha._id,
    supplyType: SupplyType.WATER,
    unit: 'bottles',
    quantityAvailable: 1200,
  });
  await SupplyDistribution.create({
    shelter: central._id,
    stock: water._id,
    organisation: redCross._id,
    supplyType: SupplyType.WATER,
    district: areas.gampaha._id,
    quantity: 500,
    distributedAt: new Date('2026-10-01T10:00:00.000Z'),
    loggedBy: officer._id,
  });
});

const get = (path, user) => {
  const req = request(app).get(path);
  return user ? req.set('Authorization', bearerFor(user)) : req;
};

describe('GET /api/operational-picture', () => {
  it("TC-01: a district officer gets their own district's shelters, teams and logs", async () => {
    const res = await get('/api/operational-picture', officer);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.district).toEqual({ id: areas.gampaha.id, name: 'Gampaha' });
    expect(res.body.data.incident.name).toBe('Flood – Gampaha District');
    expect(res.body.data.shelters.map((s) => s.name)).toEqual(['Gampaha Central College']);
    expect(res.body.data.shelters[0]).toMatchObject({ rate: 0.92, status: 'NEAR_CAPACITY' });
    expect(res.body.data.teams.map((t) => t.name)).toEqual(['Team Alpha']);
    expect(res.body.data.recentDistributions).toHaveLength(1);
    expect(res.body.data.summary).toEqual({
      shelters: 1,
      sheltersNearCapacity: 1,
      teams: 1,
      teamsAvailable: 1,
      suppliesDistributed: 500,
      affectedPeople: 460,
    });
  });

  it('TC-01: a district officer may name their own district', async () => {
    const res = await get(`/api/operational-picture?districtId=${areas.gampaha.id}`, officer);

    expect(res.status).toBe(200);
    expect(res.body.data.district.id).toBe(areas.gampaha.id);
  });

  it('TC-02: a district officer asking for another district gets 403', async () => {
    const res = await get(`/api/operational-picture?districtId=${areas.colombo.id}`, officer);

    expect(res.status).toBe(403);
    expect(res.body.error).toEqual({
      code: 'FORBIDDEN',
      message: 'You can only coordinate your own district.',
    });
  });

  it.each([Role.CITIZEN, Role.COMMUNITY_VOLUNTEER, Role.RESCUE_TEAM_LEAD])(
    'TC-03: a %s gets 403',
    async (role) => {
      const user = await createUser({ role, homeDistrict: areas.gampaha });

      const res = await get(`/api/operational-picture?districtId=${areas.gampaha.id}`, user);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    },
  );

  it('TC-04: a district with no ACTIVE incident is 200 with incident null', async () => {
    const res = await get(`/api/operational-picture?districtId=${areas.colombo.id}`, dmc);

    expect(res.status).toBe(200);
    expect(res.body.data.incident).toBeNull();
    expect(res.body.data.shelters.map((s) => s.name)).toEqual(['Colombo Hall']);
  });

  it('TC-05: a DMC officer gets the combined picture with totals for every organisation', async () => {
    const res = await get(`/api/operational-picture?districtId=${areas.gampaha.id}`, dmc);

    expect(res.status).toBe(200);
    expect(res.body.data.organisation).toBeNull();
    expect(res.body.data.totalsByOrganisation).toEqual([
      {
        organisation: { id: redCross.id, name: 'Red Cross Sri Lanka', type: OrgType.NGO },
        teams: 0,
        stockItems: 1200,
        distributed: 500,
      },
      {
        organisation: { id: army.id, name: 'SL Army', type: OrgType.ARMED_FORCES },
        teams: 1,
        stockItems: 0,
        distributed: 0,
      },
    ]);
  });

  it('TC-05: a duty officer reads it as a DMC officer', async () => {
    const duty = await createUser({ role: Role.DUTY_OFFICER, shiftDistrict: areas.colombo });

    const res = await get(`/api/operational-picture?districtId=${areas.gampaha.id}`, duty);

    expect(res.status).toBe(200);
  });

  it('TC-06: the organisation filter narrows teams and distributions; shelters stay', async () => {
    const res = await get(
      `/api/operational-picture?districtId=${areas.gampaha.id}&organisationId=${army.id}`,
      dmc,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.organisation).toEqual({
      id: army.id,
      name: 'SL Army',
      type: OrgType.ARMED_FORCES,
    });
    expect(res.body.data.shelters).toHaveLength(1);
    expect(res.body.data.teams.map((t) => t.name)).toEqual(['Team Alpha']);
    expect(res.body.data.recentDistributions).toEqual([]);
    expect(res.body.data.summary.suppliesDistributed).toBe(0);
  });

  it('Main 14: a DMC officer who names no district gets 400 on districtId', async () => {
    const res = await get('/api/operational-picture', dmc);

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed.',
      errors: [{ field: 'districtId', message: 'districtId is required' }],
    });
  });

  it('Main 14: a malformed districtId or organisationId is 400', async () => {
    const res = await get('/api/operational-picture?districtId=abc&organisationId=xyz', dmc);

    expect(res.status).toBe(400);
    expect(res.body.error.errors.map((e) => e.field).sort()).toEqual([
      'districtId',
      'organisationId',
    ]);
  });

  it('Main 14: an unknown district or organisation is 404', async () => {
    const unknown = '66f7c1a2b3c4d5e6f7a8b999';

    expect((await get(`/api/operational-picture?districtId=${unknown}`, dmc)).status).toBe(404);
    expect(
      (
        await get(
          `/api/operational-picture?districtId=${areas.gampaha.id}&organisationId=${unknown}`,
          dmc,
        )
      ).status,
    ).toBe(404);
  });

  it('Main 1: no token is 401 and an expired one is 401', async () => {
    expect((await get('/api/operational-picture')).body.error.code).toBe('AUTH_HEADER_MISSING');

    const res = await request(app)
      .get('/api/operational-picture')
      .set('Authorization', expiredBearerFor(officer));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });
});

describe('GET /api/shelters', () => {
  it("TC-01: a district officer lists their own district's shelters with rate and status", async () => {
    const res = await get('/api/shelters', officer);

    expect(res.status).toBe(200);
    expect(res.body.data.shelters).toHaveLength(1);
    expect(res.body.data.shelters[0]).toMatchObject({
      name: 'Gampaha Central College',
      district: { id: areas.gampaha.id, name: 'Gampaha' },
      rate: 0.92,
      status: 'NEAR_CAPACITY',
    });
  });

  it('TC-02: another district is 403 for a district officer', async () => {
    expect((await get(`/api/shelters?districtId=${areas.colombo.id}`, officer)).status).toBe(403);
  });

  it('Main 14: a DMC officer lists any district', async () => {
    const res = await get(`/api/shelters?districtId=${areas.colombo.id}`, dmc);

    expect(res.status).toBe(200);
    expect(res.body.data.shelters.map((s) => s.name)).toEqual(['Colombo Hall']);
  });

  it('TC-03: a citizen gets 403', async () => {
    const citizen = await createUser({ role: Role.CITIZEN });

    expect((await get('/api/shelters', citizen)).status).toBe(403);
  });
});

describe('GET /api/rescue-teams', () => {
  it("TC-01: a district officer lists their own district's teams with their organisation", async () => {
    const res = await get('/api/rescue-teams', officer);

    expect(res.status).toBe(200);
    expect(res.body.data.teams).toHaveLength(1);
    expect(res.body.data.teams[0]).toMatchObject({
      name: 'Team Alpha',
      organisation: { id: army.id, name: 'SL Army', type: OrgType.ARMED_FORCES },
      status: 'AVAILABLE',
      currentTask: null,
    });
  });

  it('TC-02: another district is 403 for a district officer', async () => {
    expect((await get(`/api/rescue-teams?districtId=${areas.colombo.id}`, officer)).status).toBe(
      403,
    );
  });

  it('Main 14: a DMC officer lists any district', async () => {
    const res = await get(`/api/rescue-teams?districtId=${areas.colombo.id}`, dmc);

    expect(res.status).toBe(200);
    expect(res.body.data.teams.map((t) => t.name)).toEqual(['Team Bravo']);
  });

  it('TC-03: a rescue team lead gets 403', async () => {
    const lead = await createUser({ role: Role.RESCUE_TEAM_LEAD });

    expect((await get('/api/rescue-teams', lead)).status).toBe(403);
  });
});
