import { jest } from '@jest/globals';
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
import { seedAreas } from '../helpers/areaFixtures.js';
import { bearerFor } from '../helpers/authHelper.js';
import { createUser } from '../helpers/userFactory.js';

// UC03 E4 (DMS-150.4): an unresponsive team stays UNAVAILABLE until a district
// officer marks it available again.
const INCIDENT = { lat: 6.9555, lng: 79.9865, label: 'Biyagama – flooded road' };
const UNKNOWN_ID = '66fb0c1b2c3d4e5f6a7b8e99';

let areas;
let officer;
let colomboOfficer;
let alpha;
let incident;

const as = (user) => ({
  get: (path) => request(app).get(path).set('Authorization', bearerFor(user)),
  post: (path, body) => request(app).post(path).set('Authorization', bearerFor(user)).send(body),
});

const markAvailable = (id = alpha.id, user = officer) =>
  as(user).post(`/api/rescue-teams/${id}/availability`);

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
  const lead = await createUser({ role: Role.RESCUE_TEAM_LEAD });
  const army = await Organisation.create({ name: 'SL Army', type: OrgType.ARMED_FORCES });
  alpha = await RescueTeam.create({
    name: 'Team Alpha',
    organisation: army._id,
    district: areas.gampaha._id,
    memberCount: 8,
    lead: lead._id,
    status: TeamStatus.UNAVAILABLE,
    baseLocation: { lat: 6.9701, lng: 80.0055 },
    currentLocation: { lat: 6.9701, lng: 80.0055 },
  });
});

describe('POST /api/rescue-teams/:id/availability', () => {
  it('E4: puts an UNAVAILABLE team back in the available list', async () => {
    const res = await markAvailable();

    expect(res.status).toBe(200);
    expect(res.body.data.team).toMatchObject({
      id: alpha.id,
      name: 'Team Alpha',
      status: 'AVAILABLE',
      organisation: { name: 'SL Army' },
      currentTask: null,
    });
    expect((await RescueTeam.findById(alpha._id)).status).toBe(TeamStatus.AVAILABLE);

    const listed = await as(officer).get(
      `/api/rescue-teams/available?lat=${INCIDENT.lat}&lng=${INCIDENT.lng}`,
    );
    expect(listed.body.data.teams.map((t) => t.name)).toEqual(['Team Alpha']);
  });

  it('E4: a team that is already AVAILABLE is returned unchanged', async () => {
    await RescueTeam.updateOne({ _id: alpha._id }, { status: TeamStatus.AVAILABLE });

    const res = await markAvailable();

    expect(res.status).toBe(200);
    expect(res.body.data.team.status).toBe('AVAILABLE');
  });

  it.each([TeamStatus.DISPATCHED, TeamStatus.ON_SITE])(
    'E4: a %s team is refused with 409 INVALID_TEAM_TRANSITION and does not change',
    async (status) => {
      await RescueTeam.updateOne({ _id: alpha._id }, { status });

      const res = await markAvailable();

      expect(res.status).toBe(409);
      expect(res.body.error).toEqual({
        code: 'INVALID_TEAM_TRANSITION',
        message: `Team Alpha is ${status}; it becomes available when its dispatch is completed.`,
      });
      expect((await RescueTeam.findById(alpha._id)).status).toBe(status);
    },
  );

  it('E4: a team whose dispatch is past its deadline is first marked UNAVAILABLE, then freed', async () => {
    await RescueTeam.updateOne({ _id: alpha._id }, { status: TeamStatus.AVAILABLE });
    const dispatched = await as(officer).post('/api/dispatches', {
      teamId: alpha.id,
      incidentLocation: INCIDENT,
      priority: 'HIGH',
    });
    const dispatchId = dispatched.body.data.dispatch.id;
    await Dispatch.updateOne({ _id: dispatchId }, { ackDeadline: new Date(Date.now() - 1000) });

    const res = await markAvailable();

    expect(res.status).toBe(200);
    expect(res.body.data.team).toMatchObject({ status: 'AVAILABLE', currentTask: null });
    expect((await Dispatch.findById(dispatchId)).status).toBe('UNRESPONSIVE');
  });

  it('E4: a team dispatched while it was being freed is judged again and refused', async () => {
    const spy = jest.spyOn(RescueTeam, 'findOneAndUpdate').mockImplementationOnce(async () => {
      await RescueTeam.updateOne({ _id: alpha._id }, { status: TeamStatus.DISPATCHED });
      return null;
    });

    const res = await markAvailable();

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_TEAM_TRANSITION');
    expect((await RescueTeam.findById(alpha._id)).status).toBe(TeamStatus.DISPATCHED);
    spy.mockRestore();
  });

  it('E4: 404 for an unknown or malformed team id', async () => {
    expect((await markAvailable(UNKNOWN_ID)).status).toBe(404);
    expect((await markAvailable('not-an-id')).status).toBe(404);
  });

  it("E4: 403 for another district's officer, and the team does not change", async () => {
    const res = await markAvailable(alpha.id, colomboOfficer);

    expect(res.status).toBe(403);
    expect((await RescueTeam.findById(alpha._id)).status).toBe(TeamStatus.UNAVAILABLE);
  });

  it('E4: only a district officer may do it', async () => {
    const dmc = await createUser({ role: Role.DMC_OFFICER });
    const lead = await createUser({ role: Role.RESCUE_TEAM_LEAD });

    expect((await markAvailable(alpha.id, dmc)).status).toBe(403);
    expect((await markAvailable(alpha.id, lead)).status).toBe(403);
    expect((await request(app).post(`/api/rescue-teams/${alpha.id}/availability`)).status).toBe(
      401,
    );
  });

  it('E4: 409 NO_ACTIVE_INCIDENT once the incident has ended', async () => {
    await HazardEvent.updateOne({ _id: incident._id }, { status: EventStatus.CLOSED });

    const res = await markAvailable();

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NO_ACTIVE_INCIDENT');
    expect((await RescueTeam.findById(alpha._id)).status).toBe(TeamStatus.UNAVAILABLE);
  });
});
