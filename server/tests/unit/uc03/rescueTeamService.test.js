import { jest } from '@jest/globals';
import { EventStatus } from '../../../src/enums/EventStatus.js';
import { OrgType } from '../../../src/enums/OrgType.js';
import { Role } from '../../../src/enums/Role.js';
import { TeamStatus } from '../../../src/enums/TeamStatus.js';
import { HazardEvent } from '../../../src/models/HazardEvent.js';
import { Organisation } from '../../../src/models/Organisation.js';
import { RescueTeam } from '../../../src/models/RescueTeam.js';
import { RescueTeamService } from '../../../src/services/RescueTeamService.js';
import { ApiError } from '../../../src/utils/ApiError.js';
import { seedAreas } from '../../helpers/areaFixtures.js';
import { createUser } from '../../helpers/userFactory.js';

let areas;
let officer;
let colomboOfficer;
let dmc;
let army;
let dispatchService;
let activeIncident;
let service;

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
  colomboOfficer = await createUser({ role: Role.DISTRICT_OFFICER, district: areas.colombo });
  dmc = await createUser({ role: Role.DMC_OFFICER });
  army = await Organisation.create({ name: 'SL Army', type: OrgType.ARMED_FORCES });
  dispatchService = {
    markOverdueUnresponsive: jest.fn().mockResolvedValue(0),
    currentTasksFor: jest.fn().mockResolvedValue(new Map()),
  };
  activeIncident = { require: jest.fn().mockResolvedValue({}) };
  service = new RescueTeamService({ dispatchService, activeIncident });
});

describe('RescueTeamService.list', () => {
  it('Main 2: lists the district’s teams sorted by name, with their organisation', async () => {
    await team('Team Zulu');
    await team('Team Alpha');
    await team('Team Colombo', { district: areas.colombo._id });

    const teams = await service.list(officer);

    expect(teams.map((t) => t.name)).toEqual(['Team Alpha', 'Team Zulu']);
    expect(teams[0].organisation).toEqual({ id: army.id, name: 'SL Army', type: 'ARMED_FORCES' });
  });

  it('E4: marks the district’s overdue dispatches first, so a timed-out team reads UNAVAILABLE', async () => {
    const alpha = await team('Team Alpha', { status: TeamStatus.DISPATCHED });
    dispatchService.markOverdueUnresponsive.mockImplementation(async () => {
      await RescueTeam.updateOne({ _id: alpha._id }, { status: TeamStatus.UNAVAILABLE });
    });

    const teams = await service.list(officer);

    expect(dispatchService.markOverdueUnresponsive).toHaveBeenCalledWith({
      district: areas.gampaha.id,
    });
    expect(teams[0].status).toBe('UNAVAILABLE');
  });

  it('Main 2: each team carries the current task the dispatch service reports', async () => {
    const alpha = await team('Team Alpha');
    const task = { dispatchId: 'd1', status: 'ASSIGNED', priority: 'HIGH', incidentLocation: null };
    dispatchService.currentTasksFor.mockResolvedValue(new Map([[alpha.id, task]]));

    await team('Team Bravo');

    const teams = await service.list(officer);

    expect(teams.find((t) => t.name === 'Team Alpha').currentTask).toEqual(task);
    expect(teams.find((t) => t.name === 'Team Bravo').currentTask).toBeNull();
  });

  it('TC-02: a district officer asking for another district is 403; a DMC officer must name one', async () => {
    await expect(service.list(officer, { districtId: areas.colombo.id })).rejects.toMatchObject({
      status: 403,
    });
    await expect(service.list(dmc)).rejects.toMatchObject({ status: 400 });
    await expect(service.list(dmc, { districtId: areas.gampaha.id })).resolves.toEqual([]);
  });
});

describe('RescueTeamService.markAvailable', () => {
  it('E4: an UNAVAILABLE team becomes AVAILABLE, and the answer is the contract’s team', async () => {
    const alpha = await team('Team Alpha', { status: TeamStatus.UNAVAILABLE });

    const result = await service.markAvailable(officer, alpha.id);

    expect(result).toMatchObject({ id: alpha.id, name: 'Team Alpha', status: 'AVAILABLE' });
    expect((await RescueTeam.findById(alpha._id)).status).toBe(TeamStatus.AVAILABLE);
  });

  it('E4: judges the team after marking its own overdue dispatches, not before', async () => {
    const alpha = await team('Team Alpha', { status: TeamStatus.DISPATCHED });
    dispatchService.markOverdueUnresponsive.mockImplementation(async () => {
      await RescueTeam.updateOne({ _id: alpha._id }, { status: TeamStatus.UNAVAILABLE });
    });

    const result = await service.markAvailable(officer, alpha.id);

    expect(dispatchService.markOverdueUnresponsive).toHaveBeenCalledWith({ team: alpha._id });
    expect(result.status).toBe('AVAILABLE');
  });

  it.each([TeamStatus.DISPATCHED, TeamStatus.ON_SITE])(
    'E4: a %s team is 409 INVALID_TEAM_TRANSITION and is not changed',
    async (status) => {
      const alpha = await team('Team Alpha', { status });

      await expect(service.markAvailable(officer, alpha.id)).rejects.toMatchObject({
        status: 409,
        code: 'INVALID_TEAM_TRANSITION',
      });
      expect((await RescueTeam.findById(alpha._id)).status).toBe(status);
    },
  );

  it('E4: an AVAILABLE team is returned as it is, with no write', async () => {
    const alpha = await team('Team Alpha', { status: TeamStatus.AVAILABLE });
    const update = jest.spyOn(RescueTeam, 'findOneAndUpdate');

    const result = await service.markAvailable(officer, alpha.id);

    expect(result.status).toBe('AVAILABLE');
    expect(update).not.toHaveBeenCalled();
    update.mockRestore();
  });

  it('E4: a team made available by someone else in between is returned AVAILABLE, not an error', async () => {
    const alpha = await team('Team Alpha', { status: TeamStatus.UNAVAILABLE });
    const update = jest.spyOn(RescueTeam, 'findOneAndUpdate').mockImplementationOnce(async () => {
      await RescueTeam.updateOne({ _id: alpha._id }, { status: TeamStatus.AVAILABLE });
      return null;
    });

    const result = await service.markAvailable(officer, alpha.id);

    expect(result.status).toBe('AVAILABLE');
    update.mockRestore();
  });

  it('E4: 404 for an unknown or malformed id', async () => {
    await expect(service.markAvailable(officer, '66fb0c1b2c3d4e5f6a7b8e99')).rejects.toMatchObject({
      status: 404,
      message: 'Rescue team not found.',
    });
    await expect(service.markAvailable(officer, 'nope')).rejects.toMatchObject({ status: 404 });
  });

  it('E4: another district’s officer, and a DMC officer, are 403 and the team does not change', async () => {
    const alpha = await team('Team Alpha', { status: TeamStatus.UNAVAILABLE });

    await expect(service.markAvailable(colomboOfficer, alpha.id)).rejects.toMatchObject({
      status: 403,
    });
    await expect(service.markAvailable(dmc, alpha.id)).rejects.toMatchObject({ status: 403 });
    expect((await RescueTeam.findById(alpha._id)).status).toBe(TeamStatus.UNAVAILABLE);
    expect(dispatchService.markOverdueUnresponsive).not.toHaveBeenCalled();
  });

  it('E4: with no active incident nothing is read or changed', async () => {
    const alpha = await team('Team Alpha', { status: TeamStatus.UNAVAILABLE });
    activeIncident.require.mockRejectedValue(new ApiError(409, 'NO_ACTIVE_INCIDENT', 'none'));

    await expect(service.markAvailable(officer, alpha.id)).rejects.toMatchObject({
      status: 409,
      code: 'NO_ACTIVE_INCIDENT',
    });
    expect(activeIncident.require).toHaveBeenCalledWith(alpha.district);
    expect(dispatchService.markOverdueUnresponsive).not.toHaveBeenCalled();
    expect((await RescueTeam.findById(alpha._id)).status).toBe(TeamStatus.UNAVAILABLE);
  });
});
