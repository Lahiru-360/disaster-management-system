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

// UC03 A3 (DMS-146): the team lead declines; the officer is told and picks
// another team, with the declining one left out.
const INCIDENT = { lat: 6.9555, lng: 79.9865, label: 'Biyagama – flooded road' };

let officer;
let lead;
let alpha;
let dispatchId;

const as = (user) => ({
  get: (path) => request(app).get(path).set('Authorization', bearerFor(user)),
  post: (path, body) => request(app).post(path).set('Authorization', bearerFor(user)).send(body),
});

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
  lead = await createUser({ role: Role.RESCUE_TEAM_LEAD });
  const army = await Organisation.create({ name: 'SL Army', type: OrgType.ARMED_FORCES });
  const fire = await Organisation.create({ name: 'Fire Service', type: OrgType.GOVERNMENT });
  alpha = await RescueTeam.create({
    name: 'Team Alpha',
    organisation: army._id,
    district: areas.gampaha._id,
    memberCount: 8,
    lead: lead._id,
    baseLocation: { lat: 6.9701, lng: 80.0055 },
    currentLocation: { lat: 6.9701, lng: 80.0055 },
  });
  await RescueTeam.create({
    name: 'Team Echo',
    organisation: fire._id,
    district: areas.gampaha._id,
    memberCount: 6,
    baseLocation: { lat: 6.9993, lng: 80.023 },
    currentLocation: { lat: 6.9993, lng: 80.023 },
  });
  const res = await as(officer).post('/api/dispatches', {
    teamId: alpha.id,
    incidentLocation: INCIDENT,
    priority: 'HIGH',
  });
  dispatchId = res.body.data.dispatch.id;
});

const decline = (body, user = lead) => as(user).post(`/api/dispatches/${dispatchId}/decline`, body);

describe('POST /api/dispatches/:id/decline', () => {
  it('TC-39: A3.2 marks DECLINED, frees the team and tells the officer to choose another', async () => {
    const res = await decline({ reason: 'Vehicle unavailable' });

    expect(res.status).toBe(200);
    expect(res.body.data.dispatch).toMatchObject({
      id: dispatchId,
      status: 'DECLINED',
      declineReason: 'Vehicle unavailable',
    });
    expect((await RescueTeam.findById(alpha._id)).status).toBe('AVAILABLE');

    const inbox = await UserNotification.find({ user: officer._id });
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({
      type: 'DISPATCH_DECLINED',
      title: 'Team Alpha declined',
      body: 'Team Alpha declined (Vehicle unavailable) – choose another team',
      link: `/shelter-resources?dispatch=${dispatchId}`,
    });
  });

  it('TC-40: A3.3 re-listing with excludeTeamIds leaves the declined team out', async () => {
    await decline({ reason: 'Vehicle unavailable' });

    const res = await as(officer).get(
      `/api/rescue-teams/available?lat=${INCIDENT.lat}&lng=${INCIDENT.lng}&excludeTeamIds=${alpha.id}`,
    );

    expect(res.body.data.teams.map((t) => t.name)).toEqual(['Team Echo']);
  });

  it.each([[{}], [{ reason: '' }], [{ reason: '   ' }], [{ reason: 'x'.repeat(201) }]])(
    'TC-41: A3.1 a decline without a proper reason is 400 on reason (%p)',
    async (body) => {
      const res = await decline(body);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.errors.map((e) => e.field)).toEqual(['reason']);
      expect((await Dispatch.findById(dispatchId)).status).toBe('ASSIGNED');
    },
  );

  it('TC-42: A3 declining after acknowledging is 409 and nothing changes', async () => {
    await as(lead).post(`/api/dispatches/${dispatchId}/acknowledge`);

    const res = await decline({ reason: 'Changed our mind' });

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'INVALID_DISPATCH_TRANSITION',
      message: "This dispatch is ACKNOWLEDGED and can't be declined.",
    });
    expect((await RescueTeam.findById(alpha._id)).status).toBe('DISPATCHED');
  });

  it("TC-23: A3 another team's lead, or an officer, cannot decline (403)", async () => {
    const otherLead = await createUser({ role: Role.RESCUE_TEAM_LEAD });

    expect((await decline({ reason: 'Not mine' }, otherLead)).status).toBe(403);
    expect((await decline({ reason: 'Not mine' }, officer)).status).toBe(403);
    expect((await Dispatch.findById(dispatchId)).status).toBe('ASSIGNED');
  });

  it('A3: the lead still sees the declined dispatch as their last closed one', async () => {
    await decline({ reason: 'Vehicle unavailable' });

    const mine = await as(lead).get('/api/dispatches/mine');

    expect(mine.body.data.dispatches.map((d) => [d.id, d.status])).toEqual([
      [dispatchId, 'DECLINED'],
    ]);
  });
});
