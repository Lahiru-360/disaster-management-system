import request from 'supertest';
import { app } from '../../src/core/App.js';
import { EventStatus } from '../../src/enums/EventStatus.js';
import { OrgType } from '../../src/enums/OrgType.js';
import { Role } from '../../src/enums/Role.js';
import { Dispatch } from '../../src/models/Dispatch.js';
import { HazardEvent } from '../../src/models/HazardEvent.js';
import { Organisation } from '../../src/models/Organisation.js';
import { RescueTeam } from '../../src/models/RescueTeam.js';
import { UserNotification } from '../../src/models/UserNotification.js';
import { seedAreas } from '../helpers/areaFixtures.js';
import { bearerFor } from '../helpers/authHelper.js';
import { createUser } from '../helpers/userFactory.js';

const INCIDENT = { lat: 6.9555, lng: 79.9865, label: 'Biyagama – flooded road' };

let areas;
let officer;
let lead;
let alpha;
let echo;

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
  lead = await createUser({ role: Role.RESCUE_TEAM_LEAD });
  const army = await Organisation.create({ name: 'SL Army', type: OrgType.ARMED_FORCES });
  const fire = await Organisation.create({ name: 'Fire Service', type: OrgType.GOVERNMENT });
  const near = { lat: 6.9701, lng: 80.0055 };
  const far = { lat: 6.9993, lng: 80.023 };
  alpha = await RescueTeam.create({
    name: 'Team Alpha',
    organisation: army._id,
    district: areas.gampaha._id,
    memberCount: 8,
    lead: lead._id,
    baseLocation: near,
    currentLocation: near,
  });
  echo = await RescueTeam.create({
    name: 'Team Echo',
    organisation: fire._id,
    district: areas.gampaha._id,
    memberCount: 6,
    baseLocation: far,
    currentLocation: far,
  });
});

const as = (user) => ({
  get: (path) => request(app).get(path).set('Authorization', bearerFor(user)),
  post: (path, body) => request(app).post(path).set('Authorization', bearerFor(user)).send(body),
});

const available = (query = `lat=${INCIDENT.lat}&lng=${INCIDENT.lng}`) =>
  as(officer).get(`/api/rescue-teams/available?${query}`);

const dispatchAlpha = () =>
  as(officer).post('/api/dispatches', {
    teamId: alpha.id,
    incidentLocation: INCIDENT,
    priority: 'HIGH',
  });

describe('GET /api/rescue-teams/available', () => {
  it('TC-15: Main 7 lists available teams nearest first with their organisation and km', async () => {
    const res = await available();

    expect(res.status).toBe(200);
    expect(res.body.data.teams.map((t) => [t.name, t.organisation.name])).toEqual([
      ['Team Alpha', 'SL Army'],
      ['Team Echo', 'Fire Service'],
    ]);
    expect(res.body.data.teams[0].distanceKm).toBeLessThan(res.body.data.teams[1].distanceKm);
  });

  it('TC-16: Main 7 equidistant teams are listed in name order, every time', async () => {
    const spot = { lat: 7.0, lng: 80.0 };
    const army = await Organisation.findOne({ name: 'SL Army' });
    for (const name of ['Team Zulu', 'Team Bravo']) {
      await RescueTeam.create({
        name,
        organisation: army._id,
        district: areas.gampaha._id,
        memberCount: 4,
        baseLocation: spot,
        currentLocation: spot,
      });
    }
    const query = `lat=${spot.lat}&lng=${spot.lng}`;

    const first = await available(query);
    const second = await available(query);

    const names = first.body.data.teams.slice(0, 2).map((t) => t.name);
    expect(names).toEqual(['Team Bravo', 'Team Zulu']);
    expect(second.body.data.teams.map((t) => t.name)).toEqual(
      first.body.data.teams.map((t) => t.name),
    );
  });

  it('TC-17: Main 7 a dispatched team is no longer listed', async () => {
    await dispatchAlpha();

    expect((await available()).body.data.teams.map((t) => t.name)).toEqual(['Team Echo']);
  });

  it('TC-40: A3.3 excludeTeamIds leaves teams out', async () => {
    const res = await available(
      `lat=${INCIDENT.lat}&lng=${INCIDENT.lng}&excludeTeamIds=${alpha.id}`,
    );

    expect(res.body.data.teams.map((t) => t.name)).toEqual(['Team Echo']);
  });

  it('Main 7: missing coordinates or a bad excludeTeamIds is 400', async () => {
    const missing = await available('lat=6.9');
    const badIds = await available(`lat=6.9&lng=79.9&excludeTeamIds=abc`);

    expect(missing.status).toBe(400);
    expect(missing.body.error.errors.map((e) => e.field)).toEqual(['lng']);
    expect(badIds.status).toBe(400);
    expect(badIds.body.error.errors).toEqual([
      { field: 'excludeTeamIds', message: 'excludeTeamIds must be comma-separated ids' },
    ]);
  });

  it('Main 7: only district officers search for teams (403)', async () => {
    const dmc = await createUser({ role: Role.DMC_OFFICER });

    expect(
      (
        await as(dmc).get(
          `/api/rescue-teams/available?lat=6.9&lng=79.9&districtId=${areas.gampaha.id}`,
        )
      ).status,
    ).toBe(403);
  });
});

describe('POST /api/dispatches', () => {
  it('TC-18: Main 9 creates an ASSIGNED dispatch with a 5-minute deadline and notifies the lead', async () => {
    const res = await dispatchAlpha();

    expect(res.status).toBe(201);
    const { dispatch } = res.body.data;
    expect(dispatch).toMatchObject({
      status: 'ASSIGNED',
      team: { id: alpha.id, name: 'Team Alpha', organisation: { name: 'SL Army' } },
      incident: { name: 'Flood – Gampaha District' },
      incidentLocation: INCIDENT,
      priority: 'HIGH',
    });
    expect(new Date(dispatch.ackDeadline) - new Date(dispatch.createdAt)).toBe(5 * 60 * 1000);
    expect((await RescueTeam.findById(alpha._id)).status).toBe('DISPATCHED');

    const inbox = await UserNotification.find({ user: lead._id });
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({ type: 'ASSIGNMENT', link: `/assignments/${dispatch.id}` });
  });

  it('TC-20: Main 9 dispatching a team that is not available is 409 TEAM_NOT_AVAILABLE', async () => {
    await dispatchAlpha();

    const res = await dispatchAlpha();

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TEAM_NOT_AVAILABLE');
    expect(await Dispatch.countDocuments()).toBe(1);
  });

  it('Main 8: a bad body is 400 with one entry per field', async () => {
    const res = await as(officer).post('/api/dispatches', {
      teamId: 'x',
      incidentLocation: { lat: 100, lng: 79.9 },
      priority: 'URGENT',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.errors.map((e) => e.field).sort()).toEqual([
      'incidentLocation.lat',
      'priority',
      'teamId',
    ]);
  });

  it('Main 9: no ACTIVE incident is 409 NO_ACTIVE_INCIDENT', async () => {
    await HazardEvent.deleteMany({});

    expect((await dispatchAlpha()).body.error.code).toBe('NO_ACTIVE_INCIDENT');
  });

  it('Main 8: a rescue team lead cannot dispatch (403)', async () => {
    const res = await as(lead).post('/api/dispatches', {
      teamId: echo.id,
      incidentLocation: INCIDENT,
      priority: 'HIGH',
    });

    expect(res.status).toBe(403);
  });
});

describe('Field app: the lead answers the assignment', () => {
  let dispatchId;

  beforeEach(async () => {
    dispatchId = (await dispatchAlpha()).body.data.dispatch.id;
  });

  it('TC-21: Main 10 the lead sees the assignment and acknowledges it', async () => {
    const mine = await as(lead).get('/api/dispatches/mine');
    expect(mine.status).toBe(200);
    expect(mine.body.data.team.name).toBe('Team Alpha');
    expect(mine.body.data.dispatches.map((d) => [d.id, d.status])).toEqual([
      [dispatchId, 'ASSIGNED'],
    ]);

    const res = await as(lead).post(`/api/dispatches/${dispatchId}/acknowledge`);

    expect(res.status).toBe(200);
    expect(res.body.data.dispatch.status).toBe('ACKNOWLEDGED');
  });

  it('TC-22: Main 11 on site then complete - the team goes ON_SITE then back to AVAILABLE', async () => {
    await as(lead).post(`/api/dispatches/${dispatchId}/acknowledge`);

    const onSite = await as(lead).post(`/api/dispatches/${dispatchId}/on-site`);
    expect(onSite.body.data.dispatch.status).toBe('ON_SITE');
    expect((await RescueTeam.findById(alpha._id)).status).toBe('ON_SITE');

    const done = await as(lead).post(`/api/dispatches/${dispatchId}/complete`);
    expect(done.body.data.dispatch.status).toBe('COMPLETED');
    expect((await RescueTeam.findById(alpha._id)).status).toBe('AVAILABLE');
    expect(done.body.data.dispatch.statusHistory.map((e) => e.status)).toEqual([
      'ASSIGNED',
      'ACKNOWLEDGED',
      'ON_SITE',
      'COMPLETED',
    ]);
  });

  it("TC-23: Main 10 another team's lead acknowledging is 403", async () => {
    const otherLead = await createUser({ role: Role.RESCUE_TEAM_LEAD });

    const res = await as(otherLead).post(`/api/dispatches/${dispatchId}/acknowledge`);

    expect(res.status).toBe(403);
    expect((await Dispatch.findById(dispatchId)).status).toBe('ASSIGNED');
  });

  it('TC-24: Domain completing an ASSIGNED dispatch is 409 INVALID_DISPATCH_TRANSITION', async () => {
    const res = await as(lead).post(`/api/dispatches/${dispatchId}/complete`);

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'INVALID_DISPATCH_TRANSITION',
      message: "This dispatch is ASSIGNED and can't be completed.",
    });
  });

  it('Main 14: the dashboard shows the team busy with its current task', async () => {
    const res = await as(officer).get('/api/rescue-teams');
    const team = res.body.data.teams.find((t) => t.name === 'Team Alpha');

    expect(team).toMatchObject({
      status: 'DISPATCHED',
      currentTask: { dispatchId, status: 'ASSIGNED', priority: 'HIGH', incidentLocation: INCIDENT },
    });
  });

  it('Main 10: an officer cannot use the field-app endpoints (403)', async () => {
    expect((await as(officer).get('/api/dispatches/mine')).status).toBe(403);
    expect((await as(officer).post(`/api/dispatches/${dispatchId}/acknowledge`)).status).toBe(403);
  });

  it('Main 10: an unknown dispatch is 404', async () => {
    expect(
      (await as(lead).post('/api/dispatches/66fb0c1b2c3d4e5f6a7b8e99/acknowledge')).status,
    ).toBe(404);
  });
});
