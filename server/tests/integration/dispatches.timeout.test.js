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
import { DispatchTimeoutJob } from '../../src/jobs/DispatchTimeoutJob.js';
import { dispatchService } from '../../src/services/DispatchService.js';
import { seedAreas } from '../helpers/areaFixtures.js';
import { bearerFor } from '../helpers/authHelper.js';
import { createUser } from '../helpers/userFactory.js';

// UC03 E4 (DMS-150.3): a dispatch the lead never answered becomes UNRESPONSIVE
// the moment it is read or acted on after its deadline, without waiting for
// the timeout job.
const INCIDENT = { lat: 6.9555, lng: 79.9865, label: 'Biyagama – flooded road' };

let officer;
let lead;
let alpha;
let dispatchId;

const as = (user) => ({
  get: (path) => request(app).get(path).set('Authorization', bearerFor(user)),
  post: (path, body) => request(app).post(path).set('Authorization', bearerFor(user)).send(body),
});

// Makes the dispatch's deadline pass without waiting five minutes.
const passDeadline = (id = dispatchId) =>
  Dispatch.updateOne({ _id: id }, { ackDeadline: new Date(Date.now() - 1000) });

const inbox = () => UserNotification.find({ user: officer._id, type: 'DISPATCH_UNRESPONSIVE' });

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
  alpha = await RescueTeam.create({
    name: 'Team Alpha',
    organisation: army._id,
    district: areas.gampaha._id,
    memberCount: 8,
    lead: lead._id,
    baseLocation: { lat: 6.9701, lng: 80.0055 },
    currentLocation: { lat: 6.9701, lng: 80.0055 },
  });
  const res = await as(officer).post('/api/dispatches', {
    teamId: alpha.id,
    incidentLocation: INCIDENT,
    priority: 'HIGH',
  });
  dispatchId = res.body.data.dispatch.id;
});

describe('acting on a dispatch after its deadline', () => {
  it('TC-57: E4 acknowledging after the deadline is 409, even though no job has run', async () => {
    await passDeadline();

    const res = await as(lead).post(`/api/dispatches/${dispatchId}/acknowledge`);

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'INVALID_DISPATCH_TRANSITION',
      message: "This dispatch is UNRESPONSIVE and can't be acknowledged.",
    });
  });

  it('E4.1: the late answer leaves it UNRESPONSIVE, the team UNAVAILABLE, with a system history entry', async () => {
    await passDeadline();

    await as(lead).post(`/api/dispatches/${dispatchId}/acknowledge`);

    const stored = await Dispatch.findById(dispatchId);
    expect(stored.status).toBe('UNRESPONSIVE');
    expect(stored.statusHistory.map((entry) => entry.status)).toEqual(['ASSIGNED', 'UNRESPONSIVE']);
    expect(stored.statusHistory[1].by).toBeNull();
    expect((await RescueTeam.findById(alpha._id)).status).toBe('UNAVAILABLE');
  });

  it('E4.2: the officer who created the dispatch is told once to reassign', async () => {
    await passDeadline();

    await as(lead).post(`/api/dispatches/${dispatchId}/acknowledge`);

    const notices = await inbox();
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({
      title: 'No response from Team Alpha',
      body: 'No response from Team Alpha – reassign',
      link: `/shelter-resources?dispatch=${dispatchId}`,
    });
  });

  it('declining after the deadline is 409 too', async () => {
    await passDeadline();

    const res = await as(lead).post(`/api/dispatches/${dispatchId}/decline`, {
      reason: 'Too late',
    });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe("This dispatch is UNRESPONSIVE and can't be declined.");
  });

  it('only the lead of the team triggers it: another lead gets 403 and nothing changes', async () => {
    await passDeadline();
    const otherLead = await createUser({ role: Role.RESCUE_TEAM_LEAD });

    const res = await as(otherLead).post(`/api/dispatches/${dispatchId}/acknowledge`);

    expect(res.status).toBe(403);
    expect((await Dispatch.findById(dispatchId)).status).toBe('ASSIGNED');
  });

  it('TC-58: acknowledged before the deadline, it is never marked unresponsive', async () => {
    await as(lead).post(`/api/dispatches/${dispatchId}/acknowledge`);
    await passDeadline();

    const res = await as(lead).post(`/api/dispatches/${dispatchId}/on-site`);

    expect(res.status).toBe(200);
    expect((await Dispatch.findById(dispatchId)).status).toBe('ON_SITE');
    expect(await inbox()).toHaveLength(0);
  });

  it('before the deadline an answer works as usual', async () => {
    const res = await as(lead).post(`/api/dispatches/${dispatchId}/acknowledge`);

    expect(res.status).toBe(200);
    expect(res.body.data.dispatch.status).toBe('ACKNOWLEDGED');
  });
});

describe('reading after the deadline', () => {
  it("the lead's assignments show it as expired, with the team UNAVAILABLE", async () => {
    await passDeadline();

    const res = await as(lead).get('/api/dispatches/mine');

    expect(res.body.data.team.status).toBe('UNAVAILABLE');
    expect(res.body.data.team.currentTask).toBeNull();
    expect(res.body.data.dispatches.map((d) => [d.id, d.status])).toEqual([
      [dispatchId, 'UNRESPONSIVE'],
    ]);
  });

  it("the officer's dispatch list shows it UNRESPONSIVE", async () => {
    await passDeadline();

    const res = await as(officer).get('/api/dispatches?status=UNRESPONSIVE');

    expect(res.body.data.dispatches.map((d) => [d.id, d.status])).toEqual([
      [dispatchId, 'UNRESPONSIVE'],
    ]);
  });

  it('the dashboard shows the team UNAVAILABLE with no current task', async () => {
    await passDeadline();

    const res = await as(officer).get('/api/operational-picture');

    const team = res.body.data.teams.find((t) => t.id === alpha.id);
    expect(team.status).toBe('UNAVAILABLE');
    expect(team.currentTask).toBeNull();
  });

  it('the rescue teams list shows the team UNAVAILABLE', async () => {
    await passDeadline();

    const res = await as(officer).get('/api/rescue-teams');

    expect(res.body.data.teams[0]).toMatchObject({ status: 'UNAVAILABLE', currentTask: null });
  });

  it("an unresponsive team isn't offered for a new dispatch", async () => {
    await passDeadline();
    await as(officer).get('/api/dispatches');

    const res = await as(officer).get(
      `/api/rescue-teams/available?lat=${INCIDENT.lat}&lng=${INCIDENT.lng}`,
    );

    expect(res.body.data.teams).toEqual([]);
  });

  it('a read before the deadline changes nothing', async () => {
    await as(lead).get('/api/dispatches/mine');
    await as(officer).get('/api/dispatches');
    await as(officer).get('/api/operational-picture');

    expect((await Dispatch.findById(dispatchId)).status).toBe('ASSIGNED');
    expect((await RescueTeam.findById(alpha._id)).status).toBe('DISPATCHED');
    expect(await inbox()).toHaveLength(0);
  });

  it('several reads at once mark it, and notify the officer, only once', async () => {
    await passDeadline();

    await Promise.all([
      as(lead).get('/api/dispatches/mine'),
      as(officer).get('/api/dispatches'),
      as(officer).get('/api/operational-picture'),
      as(lead).post(`/api/dispatches/${dispatchId}/acknowledge`),
    ]);

    const stored = await Dispatch.findById(dispatchId);
    expect(stored.status).toBe('UNRESPONSIVE');
    expect(stored.statusHistory.filter((e) => e.status === 'UNRESPONSIVE')).toHaveLength(1);
    expect(await inbox()).toHaveLength(1);
  });
});

describe('DispatchTimeoutJob end to end', () => {
  it('TC-56: E4.1 a check marks it UNRESPONSIVE, the team UNAVAILABLE, and the officer sees it in their inbox and dispatch list', async () => {
    await passDeadline();

    expect(await new DispatchTimeoutJob({ dispatchService }).tick()).toBe(1);

    const list = await as(officer).get('/api/dispatches?status=UNRESPONSIVE');
    expect(list.body.data.dispatches.map((d) => d.id)).toEqual([dispatchId]);
    const teams = await as(officer).get('/api/rescue-teams');
    expect(teams.body.data.teams.find((t) => t.id === alpha.id).status).toBe('UNAVAILABLE');
    const mine = await as(officer).get('/api/notifications/me');
    expect(mine.body.data.notifications[0]).toMatchObject({
      type: 'DISPATCH_UNRESPONSIVE',
      body: 'No response from Team Alpha – reassign',
    });
  });

  it('TC-58: E4 a check before the deadline marks nothing', async () => {
    expect(await new DispatchTimeoutJob({ dispatchService }).tick()).toBe(0);

    expect((await Dispatch.findById(dispatchId)).status).toBe('ASSIGNED');
  });
});

describe('DispatchService.markOverdueUnresponsive', () => {
  it('marks every overdue ASSIGNED dispatch and says how many', async () => {
    await passDeadline();

    expect(await dispatchService.markOverdueUnresponsive()).toBe(1);
    expect(await dispatchService.markOverdueUnresponsive()).toBe(0);
  });

  it('leaves dispatches that are not ASSIGNED, or not yet overdue, alone', async () => {
    await as(lead).post(`/api/dispatches/${dispatchId}/acknowledge`);
    await passDeadline();

    expect(await dispatchService.markOverdueUnresponsive()).toBe(0);
    expect((await Dispatch.findById(dispatchId)).status).toBe('ACKNOWLEDGED');
  });

  it('can be limited to one district or team', async () => {
    await passDeadline();

    expect(await dispatchService.markOverdueUnresponsive({ team: alpha._id })).toBe(1);
  });
});
