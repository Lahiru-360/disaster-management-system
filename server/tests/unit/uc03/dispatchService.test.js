import { jest } from '@jest/globals';
import { DispatchStatus } from '../../../src/enums/DispatchStatus.js';
import { EventStatus } from '../../../src/enums/EventStatus.js';
import { NotificationType } from '../../../src/enums/NotificationType.js';
import { OrgType } from '../../../src/enums/OrgType.js';
import { Priority } from '../../../src/enums/Priority.js';
import { Role } from '../../../src/enums/Role.js';
import { TeamStatus } from '../../../src/enums/TeamStatus.js';
import { Dispatch } from '../../../src/models/Dispatch.js';
import { HazardEvent } from '../../../src/models/HazardEvent.js';
import { Organisation } from '../../../src/models/Organisation.js';
import { RescueTeam } from '../../../src/models/RescueTeam.js';
import { DispatchService } from '../../../src/services/DispatchService.js';
import { seedAreas } from '../../helpers/areaFixtures.js';
import { FakeClock } from '../../helpers/FakeClock.js';
import { createUser } from '../../helpers/userFactory.js';

const NOW = '2026-10-03T09:30:00.000Z';
// The incident: "Biyagama – flooded road".
const INCIDENT = { lat: 6.9555, lng: 79.9865, label: 'Biyagama – flooded road' };

let areas;
let officer;
let lead;
let army;
let fire;
let alpha;
let echo;
let clock;
let notifications;
let service;

const team = (name, organisation, location, fields = {}) =>
  RescueTeam.create({
    name,
    organisation,
    district: areas.gampaha._id,
    memberCount: 6,
    baseLocation: location,
    currentLocation: location,
    ...fields,
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
  lead = await createUser({ role: Role.RESCUE_TEAM_LEAD, name: 'Suresh Bandara' });
  army = await Organisation.create({ name: 'SL Army', type: OrgType.ARMED_FORCES });
  fire = await Organisation.create({ name: 'Fire Service', type: OrgType.GOVERNMENT });
  // Alpha is ~2.5 km from the incident, Echo ~6.1 km.
  alpha = await team('Team Alpha', army._id, { lat: 6.9701, lng: 80.0055 }, { lead: lead._id });
  echo = await team('Team Echo', fire._id, { lat: 6.9993, lng: 80.023 });
  clock = new FakeClock(NOW);
  notifications = { notifyUser: jest.fn().mockResolvedValue(undefined) };
  service = new DispatchService({ clock, notifications, ackTimeoutMinutes: 5 });
});

const dispatchAlpha = (fields = {}) =>
  service.dispatch(officer, {
    teamId: alpha.id,
    incidentLocation: INCIDENT,
    priority: Priority.HIGH,
    ...fields,
  });

describe('DispatchService.findNearestAvailable', () => {
  it('TC-15: Main 7 lists available teams nearest first, with their organisation and km', async () => {
    const teams = await service.findNearestAvailable(officer, INCIDENT);

    expect(teams.map((t) => [t.name, t.organisation.name])).toEqual([
      ['Team Alpha', 'SL Army'],
      ['Team Echo', 'Fire Service'],
    ]);
    expect(teams[0].distanceKm).toBeCloseTo(2.5, 0);
    expect(teams[1].distanceKm).toBeGreaterThan(teams[0].distanceKm);
    expect(Number.isInteger(teams[0].distanceKm * 10)).toBe(true);
  });

  it('TC-16: Main 7 equidistant teams are ordered by name', async () => {
    const spot = { lat: 7.0, lng: 80.0 };
    await team('Team Zulu', fire._id, spot);
    await team('Team Bravo', fire._id, spot);

    const teams = await service.findNearestAvailable(officer, spot);

    expect(teams.slice(0, 2).map((t) => t.name)).toEqual(['Team Bravo', 'Team Zulu']);
  });

  it.each([TeamStatus.DISPATCHED, TeamStatus.ON_SITE, TeamStatus.UNAVAILABLE])(
    'TC-17: Main 7 a %s team is not listed',
    async (status) => {
      await RescueTeam.updateOne({ _id: alpha._id }, { status });

      const teams = await service.findNearestAvailable(officer, INCIDENT);

      expect(teams.map((t) => t.name)).toEqual(['Team Echo']);
    },
  );

  it('TC-40: A3.3 leaves out excluded teams', async () => {
    const teams = await service.findNearestAvailable(officer, {
      ...INCIDENT,
      excludeTeamIds: [alpha.id],
    });

    expect(teams.map((t) => t.name)).toEqual(['Team Echo']);
  });

  it('TC-50: E3 no available team is an empty list', async () => {
    await RescueTeam.updateMany({}, { status: TeamStatus.DISPATCHED });

    expect(await service.findNearestAvailable(officer, INCIDENT)).toEqual([]);
  });

  it("TC-01: Main 7 never lists another district's teams", async () => {
    await RescueTeam.create({
      name: 'Team Colombo',
      organisation: army._id,
      district: areas.colombo._id,
      memberCount: 4,
      baseLocation: INCIDENT,
      currentLocation: INCIDENT,
    });

    const teams = await service.findNearestAvailable(officer, INCIDENT);

    expect(teams.map((t) => t.name)).not.toContain('Team Colombo');
  });
});

describe('DispatchService.dispatch', () => {
  it('TC-18: Main 9 creates an ASSIGNED dispatch due in 5 minutes and sets the team DISPATCHED', async () => {
    const dispatch = await dispatchAlpha();

    expect(dispatch).toMatchObject({
      status: DispatchStatus.ASSIGNED,
      team: { id: alpha.id, name: 'Team Alpha', organisation: { name: 'SL Army' } },
      district: { id: areas.gampaha.id, name: 'Gampaha' },
      incident: { name: 'Flood – Gampaha District' },
      incidentLocation: INCIDENT,
      priority: Priority.HIGH,
      supportRequested: false,
      createdBy: { id: officer.id },
      createdAt: new Date(NOW),
      ackDeadline: new Date('2026-10-03T09:35:00.000Z'),
      declineReason: null,
    });
    expect(dispatch.statusHistory).toEqual([
      {
        status: DispatchStatus.ASSIGNED,
        at: new Date(NOW),
        by: { id: officer.id, name: officer.name },
      },
    ]);
    expect((await RescueTeam.findById(alpha._id)).status).toBe(TeamStatus.DISPATCHED);
  });

  it('TC-18: Main 9 notifies the team lead with a link to the assignment', async () => {
    const dispatch = await dispatchAlpha();

    expect(notifications.notifyUser).toHaveBeenCalledWith(lead.id, {
      type: NotificationType.ASSIGNMENT,
      title: 'New assignment for Team Alpha',
      body: 'New assignment – Biyagama – flooded road (HIGH). Respond within 5 min.',
      link: `/assignments/${dispatch.id}`,
    });
  });

  it('TC-19: Main 9 a 2-minute setting gives a deadline 2 minutes on', async () => {
    service = new DispatchService({ clock, notifications, ackTimeoutMinutes: 2 });

    const dispatch = await dispatchAlpha();

    expect(dispatch.ackDeadline).toEqual(new Date('2026-10-03T09:32:00.000Z'));
  });

  it('Main 9: a team without a lead is dispatched and nobody is notified', async () => {
    const dispatch = await service.dispatch(officer, {
      teamId: echo.id,
      incidentLocation: INCIDENT,
      priority: Priority.LOW,
    });

    expect(dispatch.status).toBe(DispatchStatus.ASSIGNED);
    expect(notifications.notifyUser).not.toHaveBeenCalled();
  });

  it('Main 9: a failed notification never fails the dispatch', async () => {
    notifications.notifyUser.mockRejectedValue(new Error('inbox down'));
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});

    const dispatch = await dispatchAlpha();

    expect(dispatch.status).toBe(DispatchStatus.ASSIGNED);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('TC-20: Main 9 a team that is not AVAILABLE is 409 TEAM_NOT_AVAILABLE, nothing created', async () => {
    await RescueTeam.updateOne({ _id: alpha._id }, { status: TeamStatus.DISPATCHED });

    await expect(dispatchAlpha()).rejects.toMatchObject({
      status: 409,
      code: 'TEAM_NOT_AVAILABLE',
      message: "Team Alpha is DISPATCHED and can't take a new dispatch.",
    });
    expect(await Dispatch.countDocuments()).toBe(0);
  });

  it('TC-20: Main 9 two officers racing for one team - exactly one dispatch wins', async () => {
    const results = await Promise.allSettled([dispatchAlpha(), dispatchAlpha()]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((r) => r.status === 'rejected').reason.code).toBe('TEAM_NOT_AVAILABLE');
    expect(await Dispatch.countDocuments()).toBe(1);
  });

  it('Main 9: if the dispatch cannot be saved the team is freed again', async () => {
    const failing = {
      create: jest.fn().mockRejectedValue(new Error('write failed')),
    };
    service = new DispatchService({ clock, notifications, dispatchModel: failing });

    await expect(dispatchAlpha()).rejects.toThrow('write failed');
    expect((await RescueTeam.findById(alpha._id)).status).toBe(TeamStatus.AVAILABLE);
  });

  it('TC-29: Main 9 a team in another district is 403', async () => {
    const colombo = await createUser({ role: Role.DISTRICT_OFFICER, district: areas.colombo });

    await expect(
      service.dispatch(colombo, { teamId: alpha.id, incidentLocation: INCIDENT, priority: 'HIGH' }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('Main 9: no ACTIVE incident is 409 NO_ACTIVE_INCIDENT and the team stays AVAILABLE', async () => {
    await HazardEvent.deleteMany({});

    await expect(dispatchAlpha()).rejects.toMatchObject({ code: 'NO_ACTIVE_INCIDENT' });
    expect((await RescueTeam.findById(alpha._id)).status).toBe(TeamStatus.AVAILABLE);
  });

  it('Main 8: an unknown or malformed team id is 404', async () => {
    await expect(dispatchAlpha({ teamId: '66fb0b1b2c3d4e5f6a7b8d99' })).rejects.toMatchObject({
      status: 404,
      message: 'Rescue team not found.',
    });
    await expect(dispatchAlpha({ teamId: 'x' })).rejects.toMatchObject({ status: 404 });
  });
});

describe('DispatchService lead moves', () => {
  let dispatchId;

  beforeEach(async () => {
    dispatchId = (await dispatchAlpha()).id;
    clock.advance(2 * FakeClock.MINUTE);
  });

  it('TC-21: Main 10 the lead acknowledges; the team stays DISPATCHED', async () => {
    const dispatch = await service.acknowledge(lead, dispatchId);

    expect(dispatch.status).toBe(DispatchStatus.ACKNOWLEDGED);
    expect(dispatch.statusHistory[1]).toEqual({
      status: DispatchStatus.ACKNOWLEDGED,
      at: new Date('2026-10-03T09:32:00.000Z'),
      by: { id: lead.id, name: 'Suresh Bandara' },
    });
    expect((await RescueTeam.findById(alpha._id)).status).toBe(TeamStatus.DISPATCHED);
  });

  it('TC-22: Main 11 on site moves the team ON_SITE at the incident, complete frees it', async () => {
    await service.acknowledge(lead, dispatchId);

    const onSite = await service.markOnSite(lead, dispatchId);
    const team = await RescueTeam.findById(alpha._id);
    expect(onSite.status).toBe(DispatchStatus.ON_SITE);
    expect(team.status).toBe(TeamStatus.ON_SITE);
    expect(team.currentLocation.toObject()).toEqual(INCIDENT);

    const completed = await service.complete(lead, dispatchId);
    expect(completed.status).toBe(DispatchStatus.COMPLETED);
    expect((await RescueTeam.findById(alpha._id)).status).toBe(TeamStatus.AVAILABLE);
    expect(completed.statusHistory.map((entry) => entry.status)).toEqual([
      DispatchStatus.ASSIGNED,
      DispatchStatus.ACKNOWLEDGED,
      DispatchStatus.ON_SITE,
      DispatchStatus.COMPLETED,
    ]);
  });

  it("TC-23: Main 10 another team's lead is 403 and nothing changes", async () => {
    const otherLead = await createUser({ role: Role.RESCUE_TEAM_LEAD });

    await expect(service.acknowledge(otherLead, dispatchId)).rejects.toMatchObject({
      status: 403,
      message: 'Only the lead of the assigned team can do this.',
    });
    expect((await Dispatch.findById(dispatchId)).status).toBe(DispatchStatus.ASSIGNED);
  });

  it('TC-24: Domain completing an ASSIGNED dispatch is 409 INVALID_DISPATCH_TRANSITION', async () => {
    await expect(service.complete(lead, dispatchId)).rejects.toMatchObject({
      status: 409,
      code: 'INVALID_DISPATCH_TRANSITION',
      message: "This dispatch is ASSIGNED and can't be completed.",
    });
    expect((await RescueTeam.findById(alpha._id)).status).toBe(TeamStatus.DISPATCHED);
  });

  it('Main 10: two acknowledgements at once - one wins, the other is 409', async () => {
    const results = await Promise.allSettled([
      service.acknowledge(lead, dispatchId),
      service.acknowledge(lead, dispatchId),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((r) => r.status === 'rejected').reason.code).toBe(
      'INVALID_DISPATCH_TRANSITION',
    );
    expect((await Dispatch.findById(dispatchId)).statusHistory).toHaveLength(2);
  });

  it('Main 10: an unknown or malformed dispatch id is 404', async () => {
    await expect(service.acknowledge(lead, '66fb0c1b2c3d4e5f6a7b8e99')).rejects.toMatchObject({
      status: 404,
      message: 'Dispatch not found.',
    });
    await expect(service.acknowledge(lead, 'nope')).rejects.toMatchObject({ status: 404 });
  });
});
