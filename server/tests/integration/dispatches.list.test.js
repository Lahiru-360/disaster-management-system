import request from 'supertest';
import { app } from '../../src/core/App.js';
import { EventStatus } from '../../src/enums/EventStatus.js';
import { OrgType } from '../../src/enums/OrgType.js';
import { Role } from '../../src/enums/Role.js';
import { HazardEvent } from '../../src/models/HazardEvent.js';
import { Organisation } from '../../src/models/Organisation.js';
import { RescueTeam } from '../../src/models/RescueTeam.js';
import { seedAreas } from '../helpers/areaFixtures.js';
import { bearerFor } from '../helpers/authHelper.js';
import { createUser } from '../helpers/userFactory.js';

// UC03 A3.2 / E4.2 (DMS-146): the officer console lists the district's
// dispatches - the declined ones above all - to prompt a reassignment (§13.7.3).
const INCIDENT = { lat: 6.9555, lng: 79.9865, label: 'Biyagama – flooded road' };

let areas;
let officer;
let alphaLead;
let echoLead;
let alpha;
let echo;

const as = (user) => ({
  get: (path) => request(app).get(path).set('Authorization', bearerFor(user)),
  post: (path, body) => request(app).post(path).set('Authorization', bearerFor(user)).send(body),
});

const dispatchTo = async (team, priority = 'HIGH') => {
  const res = await as(officer).post('/api/dispatches', {
    teamId: team.id,
    incidentLocation: INCIDENT,
    priority,
  });
  return res.body.data.dispatch.id;
};

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
  alphaLead = await createUser({ role: Role.RESCUE_TEAM_LEAD });
  echoLead = await createUser({ role: Role.RESCUE_TEAM_LEAD });
  const army = await Organisation.create({ name: 'SL Army', type: OrgType.ARMED_FORCES });
  const fire = await Organisation.create({ name: 'Fire Service', type: OrgType.GOVERNMENT });
  const team = (name, organisation, lead, lat) =>
    RescueTeam.create({
      name,
      organisation: organisation._id,
      district: areas.gampaha._id,
      memberCount: 6,
      lead: lead._id,
      baseLocation: { lat, lng: 80.0 },
      currentLocation: { lat, lng: 80.0 },
    });
  alpha = await team('Team Alpha', army, alphaLead, 6.97);
  echo = await team('Team Echo', fire, echoLead, 6.99);
});

describe('GET /api/dispatches', () => {
  it('A3.2: lists the declined dispatch with its team, reason and location, for the reassign prompt', async () => {
    const id = await dispatchTo(alpha);
    await as(alphaLead).post(`/api/dispatches/${id}/decline`, { reason: 'Vehicle unavailable' });

    const res = await as(officer).get('/api/dispatches?status=DECLINED');

    expect(res.status).toBe(200);
    expect(res.body.data.dispatches).toHaveLength(1);
    expect(res.body.data.dispatches[0]).toMatchObject({
      id,
      status: 'DECLINED',
      declineReason: 'Vehicle unavailable',
      team: { name: 'Team Alpha', organisation: { name: 'SL Army' } },
      incidentLocation: INCIDENT,
      priority: 'HIGH',
      createdBy: { id: officer.id },
    });
  });

  it('filters by one status, or by several separated by commas', async () => {
    const declined = await dispatchTo(alpha);
    await as(alphaLead).post(`/api/dispatches/${declined}/decline`, { reason: 'Engaged' });
    const open = await dispatchTo(echo, 'LOW');

    const onlyOpen = await as(officer).get('/api/dispatches?status=ASSIGNED');
    const both = await as(officer).get('/api/dispatches?status=ASSIGNED,DECLINED');

    expect(onlyOpen.body.data.dispatches.map((d) => d.id)).toEqual([open]);
    expect(both.body.data.dispatches.map((d) => d.id).sort()).toEqual([declined, open].sort());
  });

  it('lists every status, newest first, when no status is given', async () => {
    const first = await dispatchTo(alpha);
    const second = await dispatchTo(echo);

    const res = await as(officer).get('/api/dispatches');

    expect(res.status).toBe(200);
    expect(res.body.data.dispatches.map((d) => d.id)).toEqual([second, first]);
  });

  it('is empty, not an error, when nothing matches', async () => {
    await dispatchTo(alpha);

    const res = await as(officer).get('/api/dispatches?status=COMPLETED');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ dispatches: [] });
  });

  it('works when the district has no active incident, since it is a read', async () => {
    await dispatchTo(alpha);
    await HazardEvent.deleteMany({});

    const res = await as(officer).get('/api/dispatches');

    expect(res.status).toBe(200);
    expect(res.body.data.dispatches).toHaveLength(1);
  });

  it("never lists another district's dispatches", async () => {
    await dispatchTo(alpha);
    await HazardEvent.create({
      name: 'Flood – Colombo District',
      hazardType: 'FLOOD',
      status: EventStatus.ACTIVE,
      startDate: new Date('2026-09-25T00:00:00.000Z'),
      districts: [areas.colombo._id],
    });
    const colomboOfficer = await createUser({
      role: Role.DISTRICT_OFFICER,
      district: areas.colombo,
    });

    const res = await as(colomboOfficer).get('/api/dispatches');

    expect(res.body.data.dispatches).toEqual([]);
  });

  it('lets a DMC officer read a named district, and needs the district named', async () => {
    const id = await dispatchTo(alpha);
    const dmc = await createUser({ role: Role.DMC_OFFICER });

    const named = await as(dmc).get(`/api/dispatches?districtId=${areas.gampaha.id}`);
    const unnamed = await as(dmc).get('/api/dispatches');

    expect(named.body.data.dispatches.map((d) => d.id)).toEqual([id]);
    expect(unnamed.status).toBe(400);
    expect(unnamed.body.error.errors.map((e) => e.field)).toEqual(['districtId']);
  });

  it('404 for a DMC officer asking about a district that does not exist', async () => {
    const dmc = await createUser({ role: Role.DMC_OFFICER });

    const res = await as(dmc).get('/api/dispatches?districtId=66f7c1a2b3c4d5e6f7a8b999');

    expect(res.status).toBe(404);
  });

  it.each(['DONE', 'declined', 'DECLINED,NOPE', 'ASSIGNED,,DECLINED'])(
    'a status of %p is 400 VALIDATION_ERROR on status',
    async (status) => {
      const res = await as(officer).get(`/api/dispatches?status=${status}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.errors.map((e) => e.field)).toEqual(['status']);
    },
  );

  it('403 for a district officer asking about another district', async () => {
    const res = await as(officer).get(`/api/dispatches?districtId=${areas.colombo.id}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('403 for a rescue team lead, who has /mine instead', async () => {
    const res = await as(alphaLead).get('/api/dispatches');

    expect(res.status).toBe(403);
  });

  it('401 without a token', async () => {
    const res = await request(app).get('/api/dispatches');

    expect(res.status).toBe(401);
  });
});
