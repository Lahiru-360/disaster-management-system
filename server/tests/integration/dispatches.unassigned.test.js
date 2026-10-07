import request from 'supertest';
import { app } from '../../src/core/App.js';
import { EventStatus } from '../../src/enums/EventStatus.js';
import { OrgType } from '../../src/enums/OrgType.js';
import { Role } from '../../src/enums/Role.js';
import { TeamStatus } from '../../src/enums/TeamStatus.js';
import { Dispatch } from '../../src/models/Dispatch.js';
import { HazardEvent } from '../../src/models/HazardEvent.js';
import { Organisation } from '../../src/models/Organisation.js';
import { RescueTeam } from '../../src/models/RescueTeam.js';
import { UserNotification } from '../../src/models/UserNotification.js';
import { seedAreas } from '../helpers/areaFixtures.js';
import { bearerFor } from '../helpers/authHelper.js';
import { createUser } from '../helpers/userFactory.js';

// UC03 E3 (DMS-149): no team is available, so the officer asks the DMC for
// support and the incident waits in the unassigned queue until a team is free.
const INCIDENT = { lat: 6.9555, lng: 79.9865, label: 'Biyagama – flooded road' };
const UNKNOWN_ID = '66fb0c1b2c3d4e5f6a7b8e99';

let areas;
let officer;
let colomboOfficer;
let dmcOfficer;
let lead;
let alpha;
let incident;

const as = (user) => ({
  get: (path) => request(app).get(path).set('Authorization', bearerFor(user)),
  post: (path, body) => request(app).post(path).set('Authorization', bearerFor(user)).send(body),
});

const queue = (body = {}, user = officer) =>
  as(user).post('/api/dispatches/unassigned', {
    incidentLocation: INCIDENT,
    priority: 'HIGH',
    ...body,
  });

const assign = (id, body, user = officer) => as(user).post(`/api/dispatches/${id}/assign`, body);

beforeEach(async () => {
  areas = await seedAreas();
  incident = await HazardEvent.create({
    name: 'Flood – Gampaha District',
    hazardType: 'FLOOD',
    status: EventStatus.ACTIVE,
    startDate: new Date('2026-09-25T00:00:00.000Z'),
    districts: [areas.gampaha._id],
  });
  officer = await createUser({ role: Role.DISTRICT_OFFICER, district: areas.gampaha });
  colomboOfficer = await createUser({ role: Role.DISTRICT_OFFICER, district: areas.colombo });
  dmcOfficer = await createUser({ role: Role.DMC_OFFICER });
  lead = await createUser({ role: Role.RESCUE_TEAM_LEAD });
  const army = await Organisation.create({ name: 'SL Army', type: OrgType.ARMED_FORCES });
  alpha = await RescueTeam.create({
    name: 'Team Alpha',
    organisation: army._id,
    district: areas.gampaha._id,
    memberCount: 8,
    lead: lead._id,
    baseLocation: { lat: 6.9701, lng: 80.0055 },
    currentLocation: { lat: 6.9701, lng: 80.0055 },
  });
});

describe('E3: no team available', () => {
  it('TC-50: the available list is empty with 200 once every team is busy', async () => {
    await RescueTeam.updateMany({}, { status: TeamStatus.DISPATCHED });

    const res = await as(officer).get(
      `/api/rescue-teams/available?lat=${INCIDENT.lat}&lng=${INCIDENT.lng}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.teams).toEqual([]);
  });
});

describe('POST /api/dispatches/unassigned', () => {
  it('TC-51: E3.2 creates an UNASSIGNED dispatch with no team and no deadline', async () => {
    const res = await queue();

    expect(res.status).toBe(201);
    expect(res.body.data.dispatch).toMatchObject({
      status: 'UNASSIGNED',
      team: null,
      ackDeadline: null,
      supportRequested: true,
      priority: 'HIGH',
      incidentLocation: INCIDENT,
      district: { id: areas.gampaha.id, name: 'Gampaha' },
      incident: { id: incident.id },
      createdBy: { id: officer.id },
    });
    expect(res.body.data.dispatch.statusHistory.map((entry) => entry.status)).toEqual([
      'UNASSIGNED',
    ]);
    const stored = await Dispatch.findById(res.body.data.dispatch.id);
    expect(stored.team).toBeNull();
  });

  it('TC-51: E3.2 tells every DMC officer that the district asks for rescue support', async () => {
    const otherDmc = await createUser({ role: Role.DMC_OFFICER });

    const res = await queue();

    for (const dmc of [dmcOfficer, otherDmc]) {
      const items = await UserNotification.find({ user: dmc._id });
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        type: 'SUPPORT_REQUEST',
        body: 'Gampaha requests rescue support – Biyagama – flooded road, HIGH',
      });
    }
    expect(await UserNotification.countDocuments({ user: officer._id })).toBe(0);
    expect(res.body.data.dispatch.id).toBeDefined();
  });

  it('TC-51: E3.2 queues quietly, with no notification, when support is not requested', async () => {
    const res = await queue({ supportRequested: false });

    expect(res.status).toBe(201);
    expect(res.body.data.dispatch).toMatchObject({ status: 'UNASSIGNED', supportRequested: false });
    expect(await UserNotification.countDocuments({})).toBe(0);
  });

  it('E3.2: the queued incident is listed under ?status=UNASSIGNED', async () => {
    const queued = await queue();

    const res = await as(officer).get('/api/dispatches?status=UNASSIGNED');

    expect(res.status).toBe(200);
    expect(res.body.data.dispatches.map((d) => d.id)).toEqual([queued.body.data.dispatch.id]);
  });

  it.each([
    ['a missing priority', { priority: undefined }, 'priority'],
    ['an unknown priority', { priority: 'URGENT' }, 'priority'],
    ['a missing location', { incidentLocation: undefined }, 'incidentLocation'],
    ['a latitude off the globe', { incidentLocation: { lat: 91, lng: 0 } }, 'incidentLocation.lat'],
    ['a non-boolean supportRequested', { supportRequested: 'yes' }, 'supportRequested'],
  ])('E3.2: refuses %s with 400', async (_name, body, field) => {
    const res = await queue(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.errors.map((e) => e.field)).toContain(field);
    expect(await Dispatch.countDocuments({})).toBe(0);
  });

  it('E3.2: 409 NO_ACTIVE_INCIDENT when the district has no active incident', async () => {
    await HazardEvent.updateOne({ _id: incident._id }, { status: EventStatus.CLOSED });

    const res = await queue();

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NO_ACTIVE_INCIDENT');
    expect(await Dispatch.countDocuments({})).toBe(0);
  });

  it('E3.2: only a district officer may queue an incident', async () => {
    for (const user of [dmcOfficer, lead]) {
      expect((await queue({}, user)).status).toBe(403);
    }
    expect((await request(app).post('/api/dispatches/unassigned').send({})).status).toBe(401);
  });
});

describe('POST /api/dispatches/:id/assign', () => {
  let dispatchId;

  beforeEach(async () => {
    dispatchId = (await queue()).body.data.dispatch.id;
    await UserNotification.deleteMany({});
  });

  it('TC-52: E3 moves UNASSIGNED to ASSIGNED with a new deadline and the team DISPATCHED', async () => {
    const before = Date.now();

    const res = await assign(dispatchId, { teamId: alpha.id });

    expect(res.status).toBe(200);
    const { dispatch } = res.body.data;
    expect(dispatch).toMatchObject({
      id: dispatchId,
      status: 'ASSIGNED',
      team: { id: alpha.id, name: 'Team Alpha', organisation: { name: 'SL Army' } },
    });
    expect(new Date(dispatch.ackDeadline).getTime()).toBeGreaterThanOrEqual(before + 5 * 60 * 1000);
    expect(dispatch.statusHistory.map((entry) => entry.status)).toEqual(['UNASSIGNED', 'ASSIGNED']);
    expect((await RescueTeam.findById(alpha._id)).status).toBe(TeamStatus.DISPATCHED);
  });

  it("TC-52: E3 sends the team's lead the assignment, as in step 9", async () => {
    await assign(dispatchId, { teamId: alpha.id });

    const items = await UserNotification.find({ user: lead._id });
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('ASSIGNMENT');
    expect(items[0].link).toBe(`/assignments/${dispatchId}`);
  });

  it('TC-52: E3 the assigned dispatch carries on as any other: the lead can acknowledge it', async () => {
    await assign(dispatchId, { teamId: alpha.id });

    const res = await as(lead).post(`/api/dispatches/${dispatchId}/acknowledge`);

    expect(res.status).toBe(200);
    expect(res.body.data.dispatch.status).toBe('ACKNOWLEDGED');
  });

  it.each([TeamStatus.DISPATCHED, TeamStatus.ON_SITE, TeamStatus.UNAVAILABLE])(
    'TC-53: E3 a %s team is refused with 409 TEAM_NOT_AVAILABLE and the dispatch stays queued',
    async (status) => {
      await RescueTeam.updateOne({ _id: alpha._id }, { status });

      const res = await assign(dispatchId, { teamId: alpha.id });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('TEAM_NOT_AVAILABLE');
      const stored = await Dispatch.findById(dispatchId);
      expect(stored).toMatchObject({ status: 'UNASSIGNED', team: null, ackDeadline: null });
      expect((await RescueTeam.findById(alpha._id)).status).toBe(status);
      expect(await UserNotification.countDocuments({ user: lead._id })).toBe(0);
    },
  );

  it('E3: a dispatch that is already ASSIGNED is refused with 409 and the second team stays free', async () => {
    await assign(dispatchId, { teamId: alpha.id });
    const army = await Organisation.findOne({ name: 'SL Army' });
    const echo = await RescueTeam.create({
      name: 'Team Echo',
      organisation: army._id,
      district: areas.gampaha._id,
      memberCount: 6,
      baseLocation: { lat: 6.9993, lng: 80.023 },
      currentLocation: { lat: 6.9993, lng: 80.023 },
    });

    const res = await assign(dispatchId, { teamId: echo.id });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_DISPATCH_TRANSITION');
    expect((await RescueTeam.findById(echo._id)).status).toBe(TeamStatus.AVAILABLE);
    expect((await Dispatch.findById(dispatchId)).team.toString()).toBe(alpha.id);
  });

  it('E3: refuses a missing or malformed teamId with 400', async () => {
    for (const body of [{}, { teamId: 'abc' }]) {
      const res = await assign(dispatchId, body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('E3: 404 for an unknown dispatch or team', async () => {
    expect((await assign(UNKNOWN_ID, { teamId: alpha.id })).status).toBe(404);
    expect((await assign('not-an-id', { teamId: alpha.id })).status).toBe(404);
    expect((await assign(dispatchId, { teamId: UNKNOWN_ID })).status).toBe(404);
  });

  it("E3: 403 for another district's officer, and for a team of another district", async () => {
    expect((await assign(dispatchId, { teamId: alpha.id }, colomboOfficer)).status).toBe(403);

    const army = await Organisation.findOne({ name: 'SL Army' });
    const colomboTeam = await RescueTeam.create({
      name: 'Team Colombo',
      organisation: army._id,
      district: areas.colombo._id,
      memberCount: 4,
      baseLocation: INCIDENT,
      currentLocation: INCIDENT,
    });
    const res = await assign(dispatchId, { teamId: colomboTeam.id });

    expect(res.status).toBe(403);
    expect((await RescueTeam.findById(colomboTeam._id)).status).toBe(TeamStatus.AVAILABLE);
  });

  it('E3: only a district officer may assign', async () => {
    for (const user of [dmcOfficer, lead]) {
      expect((await assign(dispatchId, { teamId: alpha.id }, user)).status).toBe(403);
    }
    expect((await request(app).post(`/api/dispatches/${dispatchId}/assign`).send({})).status).toBe(
      401,
    );
  });

  it('E3: 409 NO_ACTIVE_INCIDENT once the incident has ended, and the team is not claimed', async () => {
    await HazardEvent.updateOne({ _id: incident._id }, { status: EventStatus.CLOSED });

    const res = await assign(dispatchId, { teamId: alpha.id });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NO_ACTIVE_INCIDENT');
    expect((await RescueTeam.findById(alpha._id)).status).toBe(TeamStatus.AVAILABLE);
  });
});
