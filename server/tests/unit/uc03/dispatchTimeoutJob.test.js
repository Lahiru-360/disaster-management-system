import { jest } from '@jest/globals';
import { DispatchStatus } from '../../../src/enums/DispatchStatus.js';
import { EventStatus } from '../../../src/enums/EventStatus.js';
import { NotificationType } from '../../../src/enums/NotificationType.js';
import { OrgType } from '../../../src/enums/OrgType.js';
import { Priority } from '../../../src/enums/Priority.js';
import { Role } from '../../../src/enums/Role.js';
import { TeamStatus } from '../../../src/enums/TeamStatus.js';
import { DispatchTimeoutJob } from '../../../src/jobs/DispatchTimeoutJob.js';
import { Dispatch } from '../../../src/models/Dispatch.js';
import { HazardEvent } from '../../../src/models/HazardEvent.js';
import { Organisation } from '../../../src/models/Organisation.js';
import { RescueTeam } from '../../../src/models/RescueTeam.js';
import { DispatchService } from '../../../src/services/DispatchService.js';
import { seedAreas } from '../../helpers/areaFixtures.js';
import { FakeClock } from '../../helpers/FakeClock.js';
import { createUser } from '../../helpers/userFactory.js';

const NOW = '2026-10-03T09:30:00.000Z';
const INCIDENT = { lat: 6.9555, lng: 79.9865, label: 'Biyagama – flooded road' };
const ACK_MS = 5 * FakeClock.MINUTE;

describe('DispatchTimeoutJob against the database', () => {
  let officer;
  let alpha;
  let clock;
  let notifications;
  let service;
  let job;

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
    const lead = await createUser({ role: Role.RESCUE_TEAM_LEAD });
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
    clock = new FakeClock(NOW);
    notifications = { notifyUser: jest.fn().mockResolvedValue(undefined) };
    service = new DispatchService({ clock, notifications, ackTimeoutMinutes: 5 });
    job = new DispatchTimeoutJob({ dispatchService: service });
  });

  const dispatchAlpha = () =>
    service.dispatch(officer, {
      teamId: alpha.id,
      incidentLocation: INCIDENT,
      priority: Priority.HIGH,
    });

  it('TC-56: E4.1 a check after the deadline marks it UNRESPONSIVE, the team UNAVAILABLE, and tells the officer', async () => {
    const dispatch = await dispatchAlpha();
    clock.advance(ACK_MS + 1);

    expect(await job.tick()).toBe(1);

    const stored = await Dispatch.findById(dispatch.id);
    expect(stored.status).toBe(DispatchStatus.UNRESPONSIVE);
    expect(stored.statusHistory.map((entry) => [entry.status, entry.by])).toEqual([
      [DispatchStatus.ASSIGNED, officer._id],
      [DispatchStatus.UNRESPONSIVE, null],
    ]);
    expect((await RescueTeam.findById(alpha._id)).status).toBe(TeamStatus.UNAVAILABLE);
    expect(notifications.notifyUser).toHaveBeenLastCalledWith(
      officer.id,
      expect.objectContaining({
        type: NotificationType.DISPATCH_UNRESPONSIVE,
        body: 'No response from Team Alpha – reassign',
      }),
    );
  });

  it('TC-54: a check at exactly the deadline changes nothing', async () => {
    const dispatch = await dispatchAlpha();
    clock.advance(ACK_MS);

    expect(await job.tick()).toBe(0);
    expect((await Dispatch.findById(dispatch.id)).status).toBe(DispatchStatus.ASSIGNED);
    expect((await RescueTeam.findById(alpha._id)).status).toBe(TeamStatus.DISPATCHED);
  });

  it('TC-55: a check one millisecond later marks it', async () => {
    await dispatchAlpha();
    clock.advance(ACK_MS);
    await job.tick();
    clock.advance(1);

    expect(await job.tick()).toBe(1);
  });

  it('E4.1: a second check does not mark it or notify again', async () => {
    await dispatchAlpha();
    clock.advance(ACK_MS + 1);
    await job.tick();
    notifications.notifyUser.mockClear();

    expect(await job.tick()).toBe(0);
    expect(notifications.notifyUser).not.toHaveBeenCalled();
  });

  it('TC-58: a dispatch acknowledged in time is left alone however late the check', async () => {
    const dispatch = await dispatchAlpha();
    await Dispatch.updateOne({ _id: dispatch.id }, { status: DispatchStatus.ACKNOWLEDGED });
    clock.advance(ACK_MS * 10);

    expect(await job.tick()).toBe(0);
    expect((await Dispatch.findById(dispatch.id)).status).toBe(DispatchStatus.ACKNOWLEDGED);
    expect((await RescueTeam.findById(alpha._id)).status).toBe(TeamStatus.DISPATCHED);
  });
});

describe('DispatchTimeoutJob timer', () => {
  let service;
  let job;

  beforeEach(() => {
    jest.useFakeTimers();
    service = { markOverdueUnresponsive: jest.fn().mockResolvedValue(0) };
    job = new DispatchTimeoutJob({ dispatchService: service });
  });

  afterEach(() => {
    job.stop();
    jest.useRealTimers();
  });

  it('E4: checks every 30 seconds', async () => {
    expect(DispatchTimeoutJob.INTERVAL_MS).toBe(30000);
    job.start();

    await jest.advanceTimersByTimeAsync(29999);
    expect(service.markOverdueUnresponsive).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(service.markOverdueUnresponsive).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(60000);
    expect(service.markOverdueUnresponsive).toHaveBeenCalledTimes(3);
  });

  it('E4: checks the whole system, not one district or team', async () => {
    await job.tick();

    expect(service.markOverdueUnresponsive).toHaveBeenCalledWith();
  });

  it('E4: starting twice runs one timer, and stop ends it', async () => {
    job.start();
    job.start();
    expect(job.started).toBe(true);

    await jest.advanceTimersByTimeAsync(30000);
    expect(service.markOverdueUnresponsive).toHaveBeenCalledTimes(1);

    job.stop();
    expect(job.started).toBe(false);
    await jest.advanceTimersByTimeAsync(120000);
    expect(service.markOverdueUnresponsive).toHaveBeenCalledTimes(1);
  });

  it('E4: stopping a job that never started is harmless, and it can start again', async () => {
    job.stop();
    expect(job.started).toBe(false);

    job.start();
    await jest.advanceTimersByTimeAsync(30000);
    expect(service.markOverdueUnresponsive).toHaveBeenCalledTimes(1);
  });

  it('E4: the interval can be set', async () => {
    job = new DispatchTimeoutJob({ dispatchService: service, intervalMs: 1000 });
    job.start();

    await jest.advanceTimersByTimeAsync(3000);

    expect(service.markOverdueUnresponsive).toHaveBeenCalledTimes(3);
  });

  it('E4: a failed check is logged, not thrown, and the next one still runs', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    service.markOverdueUnresponsive.mockRejectedValueOnce(new Error('db down'));

    expect(await job.tick()).toBe(0);
    expect(error).toHaveBeenCalledWith('Dispatch timeout check failed:', 'db down');

    service.markOverdueUnresponsive.mockResolvedValueOnce(2);
    expect(await job.tick()).toBe(2);
    error.mockRestore();
  });

  it('E4: a check still running is not started a second time', async () => {
    let finish;
    service.markOverdueUnresponsive.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );

    const first = job.tick();
    expect(await job.tick()).toBe(0);
    expect(service.markOverdueUnresponsive).toHaveBeenCalledTimes(1);

    finish(1);
    expect(await first).toBe(1);
    await job.tick();
    expect(service.markOverdueUnresponsive).toHaveBeenCalledTimes(2);
  });
});
