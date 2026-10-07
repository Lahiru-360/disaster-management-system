import request from 'supertest';
import { app } from '../../src/core/App.js';
import { EventStatus } from '../../src/enums/EventStatus.js';
import { OrgType } from '../../src/enums/OrgType.js';
import { Role } from '../../src/enums/Role.js';
import { TeamStatus } from '../../src/enums/TeamStatus.js';
import { DistrictCapacityAlert } from '../../src/models/DistrictCapacityAlert.js';
import { Dispatch } from '../../src/models/Dispatch.js';
import { HazardEvent } from '../../src/models/HazardEvent.js';
import { Organisation } from '../../src/models/Organisation.js';
import { ReliefStock } from '../../src/models/ReliefStock.js';
import { RescueTeam } from '../../src/models/RescueTeam.js';
import { Shelter } from '../../src/models/Shelter.js';
import { SupplyDistribution } from '../../src/models/SupplyDistribution.js';
import { UserNotification } from '../../src/models/UserNotification.js';
import { dispatchService } from '../../src/services/DispatchService.js';
import { seedAreas } from '../helpers/areaFixtures.js';
import { bearerFor } from '../helpers/authHelper.js';
import { createUser } from '../helpers/userFactory.js';

// DMS-152.4: the races UC03 guards against. Each fires its requests at once and
// checks that exactly the allowed number win and nothing is left half done.
const INCIDENT = { lat: 6.9555, lng: 79.9865, label: 'Biyagama – flooded road' };

let areas;
let officer;
let otherOfficer;
let lead;
let army;
let water;
let shelter;

const as = (user) => ({
  get: (path) => request(app).get(path).set('Authorization', bearerFor(user)),
  post: (path, body) => request(app).post(path).set('Authorization', bearerFor(user)).send(body),
  patch: (path, body) => request(app).patch(path).set('Authorization', bearerFor(user)).send(body),
});

const statuses = (responses) => responses.map((res) => res.status).sort();

const team = (name, fields = {}) =>
  RescueTeam.create({
    name,
    organisation: army._id,
    district: areas.gampaha._id,
    memberCount: 6,
    baseLocation: { lat: 6.97, lng: 80.0 },
    currentLocation: { lat: 6.97, lng: 80.0 },
    ...fields,
  });

const queue = (user = officer) =>
  as(user)
    .post('/api/dispatches/unassigned', { incidentLocation: INCIDENT, priority: 'HIGH' })
    .then((res) => res.body.data.dispatch.id);

beforeAll(async () => {
  await Promise.all([DistrictCapacityAlert.init(), Shelter.init()]);
});

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
  otherOfficer = await createUser({ role: Role.DISTRICT_OFFICER, district: areas.gampaha });
  lead = await createUser({ role: Role.RESCUE_TEAM_LEAD });
  army = await Organisation.create({ name: 'SL Army', type: OrgType.ARMED_FORCES });
  water = await ReliefStock.create({
    organisation: army._id,
    district: areas.gampaha._id,
    supplyType: 'WATER',
    unit: 'bottles',
    quantityAvailable: 1000,
  });
  shelter = await Shelter.create({
    district: areas.gampaha._id,
    name: 'Gampaha Central College',
    location: { lat: 7.09, lng: 79.99 },
    capacity: 500,
  });
});

describe('Stock races (E5)', () => {
  const log = (quantity) =>
    as(officer).post('/api/supply-distributions', {
      shelterId: shelter.id,
      stockId: water.id,
      quantity,
    });

  it('TC-28: eight logs of 300 against 1000 - exactly three win, the stock ends at 100', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => log(300)));

    expect(statuses(results)).toEqual([201, 201, 201, 400, 400, 400, 400, 400]);
    expect((await ReliefStock.findById(water._id)).quantityAvailable).toBe(100);
    expect(await SupplyDistribution.countDocuments()).toBe(3);
  });

  it('TC-63: every loser is told what is left, and what is left is never negative', async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => log(400)));

    const lost = results.filter((res) => res.status === 400);
    expect(lost).toHaveLength(3);
    for (const res of lost) {
      expect(res.body.error.errors[0]).toMatchObject({ field: 'quantity' });
      expect(res.body.error.errors[0].message).toMatch(/^must be between 1 and \d+ \(available\)$/);
    }
    const stock = await ReliefStock.findById(water._id);
    expect(stock.quantityAvailable).toBe(200);
    expect(stock.quantityAvailable).toBeGreaterThanOrEqual(0);
  });

  it('TC-28: logs that fit together all succeed and the total is exact', async () => {
    const results = await Promise.all([log(250), log(250), log(250), log(250)]);

    expect(statuses(results)).toEqual([201, 201, 201, 201]);
    expect((await ReliefStock.findById(water._id)).quantityAvailable).toBe(0);
    expect(await SupplyDistribution.countDocuments()).toBe(4);
  });
});

describe('Team races (steps 8-9, E3)', () => {
  it('TC-20: two officers dispatching the same team at once - one 201, one 409, one dispatch', async () => {
    const alpha = await team('Team Alpha', { lead: lead._id });
    const send = (user) =>
      as(user).post('/api/dispatches', {
        teamId: alpha.id,
        incidentLocation: INCIDENT,
        priority: 'HIGH',
      });

    const results = await Promise.all([send(officer), send(otherOfficer)]);

    expect(statuses(results)).toEqual([201, 409]);
    expect(results.find((res) => res.status === 409).body.error.code).toBe('TEAM_NOT_AVAILABLE');
    expect(await Dispatch.countDocuments()).toBe(1);
    expect((await RescueTeam.findById(alpha._id)).status).toBe(TeamStatus.DISPATCHED);
    expect(await UserNotification.countDocuments({ user: lead._id })).toBe(1);
  });

  it('TC-53: one free team assigned to two queued incidents at once - one 200, one 409, one stays queued', async () => {
    const alpha = await team('Team Alpha', { lead: lead._id });
    const [first, second] = [await queue(), await queue()];

    const results = await Promise.all([
      as(officer).post(`/api/dispatches/${first}/assign`, { teamId: alpha.id }),
      as(otherOfficer).post(`/api/dispatches/${second}/assign`, { teamId: alpha.id }),
    ]);

    expect(statuses(results)).toEqual([200, 409]);
    expect(results.find((res) => res.status === 409).body.error.code).toBe('TEAM_NOT_AVAILABLE');
    expect(await Dispatch.countDocuments({ status: 'ASSIGNED' })).toBe(1);
    expect(await Dispatch.countDocuments({ status: 'UNASSIGNED' })).toBe(1);
    expect(await UserNotification.countDocuments({ user: lead._id })).toBe(1);
  });

  it('TC-52: two officers giving one queued incident different teams - one wins, the other team is freed', async () => {
    const alpha = await team('Team Alpha');
    const echo = await team('Team Echo');
    const queued = await queue();

    const results = await Promise.all([
      as(officer).post(`/api/dispatches/${queued}/assign`, { teamId: alpha.id }),
      as(otherOfficer).post(`/api/dispatches/${queued}/assign`, { teamId: echo.id }),
    ]);

    expect(statuses(results)).toEqual([200, 409]);
    expect(results.find((res) => res.status === 409).body.error.code).toBe(
      'INVALID_DISPATCH_TRANSITION',
    );
    const winner = results.find((res) => res.status === 200).body.data.dispatch.team.id;
    const loser = winner === alpha.id ? echo : alpha;
    expect((await RescueTeam.findById(winner)).status).toBe(TeamStatus.DISPATCHED);
    expect((await RescueTeam.findById(loser._id)).status).toBe(TeamStatus.AVAILABLE);
    expect((await Dispatch.findById(queued)).statusHistory.map((e) => e.status)).toEqual([
      'UNASSIGNED',
      'ASSIGNED',
    ]);
  });

  it('Main 10: the lead acknowledging twice at once - one 200, one 409, two history entries', async () => {
    const alpha = await team('Team Alpha', { lead: lead._id });
    const sent = await as(officer).post('/api/dispatches', {
      teamId: alpha.id,
      incidentLocation: INCIDENT,
      priority: 'HIGH',
    });
    const id = sent.body.data.dispatch.id;

    const results = await Promise.all([
      as(lead).post(`/api/dispatches/${id}/acknowledge`),
      as(lead).post(`/api/dispatches/${id}/acknowledge`),
    ]);

    expect(statuses(results)).toEqual([200, 409]);
    expect((await Dispatch.findById(id)).statusHistory).toHaveLength(2);
  });
});

describe('Deadline races (E4)', () => {
  it('TC-57: the lead answers and the timeout check runs at the deadline - one outcome, one notification', async () => {
    const alpha = await team('Team Alpha', { lead: lead._id });
    const sent = await as(officer).post('/api/dispatches', {
      teamId: alpha.id,
      incidentLocation: INCIDENT,
      priority: 'HIGH',
    });
    const id = sent.body.data.dispatch.id;
    await Dispatch.updateOne({ _id: id }, { ackDeadline: new Date(Date.now() - 1000) });

    const [answer, marked] = await Promise.all([
      as(lead).post(`/api/dispatches/${id}/acknowledge`),
      dispatchService.markOverdueUnresponsive(),
    ]);

    expect(answer.status).toBe(409);
    expect(marked).toBeLessThanOrEqual(1);
    const stored = await Dispatch.findById(id);
    expect(stored.status).toBe('UNRESPONSIVE');
    expect(stored.statusHistory.filter((e) => e.status === 'UNRESPONSIVE')).toHaveLength(1);
    expect((await RescueTeam.findById(alpha._id)).status).toBe(TeamStatus.UNAVAILABLE);
    expect(
      await UserNotification.countDocuments({ user: officer._id, type: 'DISPATCH_UNRESPONSIVE' }),
    ).toBe(1);
  });

  it('E4: two timeout checks at once mark a dispatch once between them', async () => {
    const alpha = await team('Team Alpha', { lead: lead._id });
    const sent = await as(officer).post('/api/dispatches', {
      teamId: alpha.id,
      incidentLocation: INCIDENT,
      priority: 'HIGH',
    });
    await Dispatch.updateOne(
      { _id: sent.body.data.dispatch.id },
      { ackDeadline: new Date(Date.now() - 1000) },
    );

    const counts = await Promise.all([
      dispatchService.markOverdueUnresponsive(),
      dispatchService.markOverdueUnresponsive(),
      dispatchService.markOverdueUnresponsive(),
    ]);

    expect(counts.reduce((sum, n) => sum + n, 0)).toBe(1);
    expect(
      await UserNotification.countDocuments({ user: officer._id, type: 'DISPATCH_UNRESPONSIVE' }),
    ).toBe(1);
  });

  it('E4: marking a team available twice at once is harmless - both 200, one AVAILABLE team', async () => {
    const alpha = await team('Team Alpha', { status: TeamStatus.UNAVAILABLE });
    const mark = (user) => as(user).post(`/api/rescue-teams/${alpha.id}/availability`);

    const results = await Promise.all([mark(officer), mark(otherOfficer)]);

    expect(statuses(results)).toEqual([200, 200]);
    expect((await RescueTeam.findById(alpha._id)).status).toBe(TeamStatus.AVAILABLE);
  });
});

describe('Shelter races (A1, E2)', () => {
  it('TC-48: simultaneous occupancy updates while no shelter has space alert the DMC once', async () => {
    const dmc = await createUser({ role: Role.DMC_OFFICER });
    // The district's other shelter (from beforeEach) must be full too.
    await Shelter.updateOne({ _id: shelter._id }, { currentOccupancy: 475 });
    const alpha = await Shelter.create({
      district: areas.gampaha._id,
      name: 'Alpha Hall',
      location: { lat: 7.09, lng: 80.0 },
      capacity: 100,
      currentOccupancy: 92,
    });
    const beta = await Shelter.create({
      district: areas.gampaha._id,
      name: 'Beta Hall',
      location: { lat: 7.1, lng: 80.0 },
      capacity: 100,
      currentOccupancy: 95,
    });
    const update = (shelter, occupants) =>
      as(officer).patch(`/api/shelters/${shelter.id}/occupancy`, { occupants });

    const results = await Promise.all([
      update(alpha, 94),
      update(beta, 97),
      update(alpha, 96),
      update(beta, 99),
    ]);

    expect(results.every((res) => res.status === 200 && res.body.data.dmcAlerted)).toBe(true);
    expect(await UserNotification.countDocuments({ user: dmc._id, type: 'SHELTER_CAPACITY' })).toBe(
      1,
    );
  });

  it('TC-32: registering the same shelter name at once - one 201, the rest 409', async () => {
    const register = (name) =>
      as(officer).post('/api/shelters', {
        name,
        location: { lat: 7.0744, lng: 79.8919 },
        capacity: 300,
      });

    const results = await Promise.all([
      register('Ja-Ela Hall'),
      register('ja-ela hall'),
      register(' Ja-Ela Hall '),
    ]);

    expect(statuses(results)).toEqual([201, 409, 409]);
    expect(await Shelter.countDocuments({ name: /ja-ela hall/i })).toBe(1);
  });
});
