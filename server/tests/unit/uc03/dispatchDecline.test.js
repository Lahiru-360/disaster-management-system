import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { Dispatch } from '../../../src/domain/coordination/Dispatch.js';
import { InvalidDispatchTransitionError } from '../../../src/domain/coordination/InvalidDispatchTransitionError.js';
import { DispatchStatus } from '../../../src/enums/DispatchStatus.js';
import { EventStatus } from '../../../src/enums/EventStatus.js';
import { NotificationType } from '../../../src/enums/NotificationType.js';
import { OrgType } from '../../../src/enums/OrgType.js';
import { Role } from '../../../src/enums/Role.js';
import { TeamStatus } from '../../../src/enums/TeamStatus.js';
import { Dispatch as DispatchModel } from '../../../src/models/Dispatch.js';
import { HazardEvent } from '../../../src/models/HazardEvent.js';
import { Organisation } from '../../../src/models/Organisation.js';
import { RescueTeam } from '../../../src/models/RescueTeam.js';
import { DispatchService } from '../../../src/services/DispatchService.js';
import { seedAreas } from '../../helpers/areaFixtures.js';
import { FakeClock } from '../../helpers/FakeClock.js';
import { createUser } from '../../helpers/userFactory.js';

const LEAD = new mongoose.Types.ObjectId();
const AT = new Date('2026-10-03T09:31:40.000Z');
const dispatch = (status) => new Dispatch({ dispatchId: '66fb0c1b2c3d4e5f6a7b8e01', status });

describe('Dispatch.decline', () => {
  it('TC-39: A3.2 ASSIGNED -> DECLINED with the reason, and the team AVAILABLE again', () => {
    const built = dispatch(DispatchStatus.ASSIGNED);

    expect(built.decline('  Vehicle unavailable  ', LEAD, AT)).toEqual({
      teamStatus: TeamStatus.AVAILABLE,
    });
    expect(built.status).toBe(DispatchStatus.DECLINED);
    expect(built.declineReason).toBe('Vehicle unavailable');
    expect(built.statusHistory).toEqual([{ status: DispatchStatus.DECLINED, at: AT, by: LEAD }]);
  });

  it.each([
    DispatchStatus.ACKNOWLEDGED,
    DispatchStatus.ON_SITE,
    DispatchStatus.COMPLETED,
    DispatchStatus.DECLINED,
    DispatchStatus.UNRESPONSIVE,
  ])('TC-42: A3 declining from %s is refused and changes nothing', (from) => {
    const built = dispatch(from);

    expect(() => built.decline('Vehicle unavailable', LEAD, AT)).toThrow(
      new InvalidDispatchTransitionError(from, 'declined'),
    );
    expect(built.status).toBe(from);
    expect(built.declineReason).toBeNull();
  });

  it.each([undefined, '', '   ', 'x'.repeat(201), 42])(
    'TC-41: A3.1 a decline needs a reason (%p refused)',
    (reason) => {
      const built = dispatch(DispatchStatus.ASSIGNED);

      expect(() => built.decline(reason, LEAD, AT)).toThrow(
        'A decline needs a reason of 1-200 characters',
      );
      expect(built.status).toBe(DispatchStatus.ASSIGNED);
    },
  );

  it('A3.1: a 200-character reason is accepted', () => {
    const built = dispatch(DispatchStatus.ASSIGNED);

    built.decline('x'.repeat(200), LEAD, AT);

    expect(built.declineReason).toHaveLength(200);
  });

  it('Domain: keeps a stored decline reason when built from a document', () => {
    expect(
      new Dispatch({ dispatchId: 'd', status: DispatchStatus.DECLINED, declineReason: 'Busy' })
        .declineReason,
    ).toBe('Busy');
  });
});

describe('DispatchService.decline', () => {
  const INCIDENT = { lat: 6.9555, lng: 79.9865, label: 'Biyagama – flooded road' };
  let officer;
  let lead;
  let alpha;
  let notifications;
  let service;
  let dispatchId;

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
      baseLocation: INCIDENT,
      currentLocation: INCIDENT,
    });
    notifications = { notifyUser: jest.fn().mockResolvedValue(undefined) };
    service = new DispatchService({
      clock: new FakeClock('2026-10-03T09:30:00.000Z'),
      notifications,
    });
    dispatchId = (
      await service.dispatch(officer, {
        teamId: alpha.id,
        incidentLocation: INCIDENT,
        priority: 'HIGH',
      })
    ).id;
    notifications.notifyUser.mockClear();
  });

  it('TC-39: A3.2 marks DECLINED with the reason, frees the team and tells the officer', async () => {
    const result = await service.decline(lead, dispatchId, { reason: 'Vehicle unavailable' });

    expect(result).toMatchObject({
      status: DispatchStatus.DECLINED,
      declineReason: 'Vehicle unavailable',
    });
    expect(result.statusHistory.map((entry) => entry.status)).toEqual([
      DispatchStatus.ASSIGNED,
      DispatchStatus.DECLINED,
    ]);
    expect((await RescueTeam.findById(alpha._id)).status).toBe(TeamStatus.AVAILABLE);
    expect(notifications.notifyUser).toHaveBeenCalledWith(officer.id, {
      type: NotificationType.DISPATCH_DECLINED,
      title: 'Team Alpha declined',
      body: 'Team Alpha declined (Vehicle unavailable) – choose another team',
      link: `/shelter-resources?dispatch=${dispatchId}`,
    });
  });

  it('TC-39: a failed notification never fails the decline', async () => {
    notifications.notifyUser.mockRejectedValue(new Error('inbox down'));
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await service.decline(lead, dispatchId, { reason: 'Team already engaged' });

    expect(result.status).toBe(DispatchStatus.DECLINED);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('TC-42: A3 declining after acknowledging is 409 and the team stays DISPATCHED', async () => {
    await service.acknowledge(lead, dispatchId);

    await expect(
      service.decline(lead, dispatchId, { reason: 'Changed our mind' }),
    ).rejects.toMatchObject({
      status: 409,
      code: 'INVALID_DISPATCH_TRANSITION',
      message: "This dispatch is ACKNOWLEDGED and can't be declined.",
    });
    expect((await RescueTeam.findById(alpha._id)).status).toBe(TeamStatus.DISPATCHED);
    expect(notifications.notifyUser).not.toHaveBeenCalled();
  });

  it("TC-23: A3 another team's lead cannot decline (403)", async () => {
    const otherLead = await createUser({ role: Role.RESCUE_TEAM_LEAD });

    await expect(
      service.decline(otherLead, dispatchId, { reason: 'Not mine' }),
    ).rejects.toMatchObject({ status: 403 });
    expect((await DispatchModel.findById(dispatchId)).status).toBe(DispatchStatus.ASSIGNED);
  });

  it('TC-40: A3.3 the declined team can be dispatched again later', async () => {
    await service.decline(lead, dispatchId, { reason: 'Vehicle unavailable' });

    const again = await service.dispatch(officer, {
      teamId: alpha.id,
      incidentLocation: INCIDENT,
      priority: 'HIGH',
    });

    expect(again.status).toBe(DispatchStatus.ASSIGNED);
    expect(again.id).not.toBe(dispatchId);
  });
});
