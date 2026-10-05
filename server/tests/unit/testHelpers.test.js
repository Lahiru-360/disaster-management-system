import mongoose from 'mongoose';
import { Role } from '../../src/enums/Role.js';
import { District } from '../../src/models/District.js';
import { User } from '../../src/models/User.js';
import { areaRegistry } from '../../src/services/AreaRegistry.js';
import { tokenService } from '../../src/services/TokenService.js';
import { NotificationChannel } from '../../src/services/notifications/NotificationChannel.js';
import { FakeChannel } from '../helpers/FakeChannel.js';
import { FakeClock } from '../helpers/FakeClock.js';
import { AREAS, seedAreas } from '../helpers/areaFixtures.js';
import { accessTokenFor, bearerFor, expiredBearerFor } from '../helpers/authHelper.js';
import { createUser } from '../helpers/userFactory.js';

// The shared helpers are test code, so they aren't covered by the coverage
// gate; these prove they do what their JSDoc says.

beforeAll(async () => {
  await User.init();
});

describe('userFactory.createUser', () => {
  it('DMS-103: creates a citizen by default, with a unique email each time', async () => {
    const first = await createUser();
    const second = await createUser();

    expect(first.role).toBe(Role.CITIZEN);
    expect(first.email).not.toBe(second.email);
    expect(await User.countDocuments()).toBe(2);
  });

  it('DMS-103: creates any role with the district fields, from a document or an id', async () => {
    const colombo = { _id: new mongoose.Types.ObjectId() };
    const gampahaId = new mongoose.Types.ObjectId();

    const dutyOfficer = await createUser({ role: Role.DUTY_OFFICER, shiftDistrict: colombo });
    const districtOfficer = await createUser({ role: Role.DISTRICT_OFFICER, district: gampahaId });
    const citizen = await createUser({ homeDistrict: colombo, phone: '0771234567' });

    expect(dutyOfficer.shiftDistrict).toEqual(colombo._id);
    expect(districtOfficer.district).toEqual(gampahaId);
    expect(citizen.homeDistrict).toEqual(colombo._id);
    expect(citizen.phone).toBe('0771234567');
  });

  it('DMS-103: lets a test override any other field', async () => {
    const user = await createUser({
      name: 'Kasun Silva',
      email: 'kasun@example.test',
      isActive: false,
    });

    expect(user).toMatchObject({
      name: 'Kasun Silva',
      email: 'kasun@example.test',
      isActive: false,
    });
  });
});

describe('areaFixtures.seedAreas', () => {
  it('DMS-103: seeds Colombo, Gampaha and Kalutara, and Kelani over the first two', async () => {
    const { colombo, gampaha, kalutara, kelani } = await seedAreas();

    expect([colombo.name, gampaha.name, kalutara.name]).toEqual(['Colombo', 'Gampaha', 'Kalutara']);
    expect(kelani.districts.map(String)).toEqual([colombo.id, gampaha.id]);
    expect(await District.countDocuments()).toBe(3);
  });

  it('DMS-103: gives the districts the known centroids in AREAS', async () => {
    const { colombo } = await seedAreas();

    expect(colombo.centroid.toObject()).toEqual(AREAS.colombo.centroid);
  });

  it('DMS-103: puts a point in the right district through AreaRegistry', async () => {
    const { gampaha } = await seedAreas();
    const { lat, lng } = AREAS.gampaha.centroid;

    expect(String((await areaRegistry.findDistrictForPoint(lat, lng)).areaId)).toBe(gampaha.id);
  });

  it('DMS-103: feeds createUser a district document directly', async () => {
    const { colombo } = await seedAreas();

    const citizen = await createUser({ homeDistrict: colombo });

    expect(citizen.homeDistrict).toEqual(colombo._id);
  });
});

describe('FakeClock', () => {
  it('DMS-103: starts at the given time and stands still until advanced', () => {
    const clock = new FakeClock('2026-09-28T08:00:00.000Z');

    expect(clock.now()).toEqual(new Date('2026-09-28T08:00:00.000Z'));
    expect(clock.now()).toEqual(clock.now());
  });

  it('DMS-103: has a fixed default start, so tests without one are deterministic', () => {
    expect(new FakeClock().now().toISOString()).toBe('2026-09-28T08:00:00.000Z');
  });

  it('DMS-103: advance() moves time on by ms, and chains', () => {
    const clock = new FakeClock('2026-09-28T08:00:00.000Z');

    clock.advance(2 * FakeClock.HOUR).advance(5 * FakeClock.MINUTE);

    expect(clock.now().toISOString()).toBe('2026-09-28T10:05:00.000Z');
  });

  it('DMS-103: set() jumps to a time', () => {
    const clock = new FakeClock();

    clock.set(new Date('2026-10-01T00:00:00.000Z'));

    expect(clock.now().toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('DMS-103: refuses an invalid time', () => {
    expect(() => new FakeClock('not a date')).toThrow('is not a valid time');
  });

  it('DMS-103: returns a new Date each call, like SystemClock', () => {
    const clock = new FakeClock();
    clock.now().setFullYear(2000);

    expect(clock.now().getFullYear()).toBe(2026);
  });
});

describe('FakeChannel', () => {
  it('DMS-103: is a NotificationChannel, so it can stand in for any channel', () => {
    expect(new FakeChannel()).toBeInstanceOf(NotificationChannel);
  });

  it('DMS-103: delivers by default and records every notification', async () => {
    const channel = new FakeChannel();

    await expect(channel.send({ title: 'First' })).resolves.toEqual({ status: 'DELIVERED' });
    await channel.send({ title: 'Second' });

    expect(channel.calls).toEqual([{ title: 'First' }, { title: 'Second' }]);
  });

  it('DMS-103: returns the scripted results in order, then delivers', async () => {
    const channel = new FakeChannel().willReturn([
      { status: 'FAILED', reason: 'no signal' },
      { status: 'SENT' },
    ]);

    expect(await channel.send({})).toEqual({ status: 'FAILED', reason: 'no signal' });
    expect(await channel.send({})).toEqual({ status: 'SENT' });
    expect(await channel.send({})).toEqual({ status: 'DELIVERED' });
  });

  it('DMS-103: throws a scripted Error, as a broken channel would, and still records the call', async () => {
    const channel = new FakeChannel().willReturn([new Error('gateway down')]);

    await expect(channel.send({ title: 'Alert' })).rejects.toThrow('gateway down');
    expect(channel.calls).toEqual([{ title: 'Alert' }]);
  });

  it('DMS-103: queues further results after those already scripted', async () => {
    const channel = new FakeChannel().willReturn([{ status: 'SENT' }]);
    channel.willReturn([{ status: 'FAILED' }]);

    expect((await channel.send({})).status).toBe('SENT');
    expect((await channel.send({})).status).toBe('FAILED');
  });

  it('DMS-103: reset() forgets calls and queued results', async () => {
    const channel = new FakeChannel().willReturn([{ status: 'FAILED' }]);
    await channel.send({});
    channel.willReturn([{ status: 'FAILED' }]).reset();

    expect(channel.calls).toEqual([]);
    expect(await channel.send({})).toEqual({ status: 'DELIVERED' });
  });

  it('DMS-103: hands each caller its own result object', async () => {
    const channel = new FakeChannel();
    const first = await channel.send({});
    first.status = 'FAILED';

    expect(await channel.send({})).toEqual({ status: 'DELIVERED' });
  });
});

describe('authHelper', () => {
  it('DMS-103: signs a token TokenService accepts, with the user id and role', async () => {
    const user = await createUser({ role: Role.DMC_OFFICER });

    expect(tokenService.verifyAccessToken(accessTokenFor(user))).toMatchObject({
      id: user.id,
      role: Role.DMC_OFFICER,
    });
  });

  it('DMS-103: bearerFor prefixes the token with "Bearer "', async () => {
    const user = await createUser();
    const [scheme, token] = bearerFor(user).split(' ');

    expect(scheme).toBe('Bearer');
    expect(tokenService.verifyAccessToken(token).id).toBe(user.id);
  });

  it('DMS-103: expiredBearerFor gives a token TokenService rejects as expired', async () => {
    const token = expiredBearerFor(await createUser()).split(' ')[1];

    expect(() => tokenService.verifyAccessToken(token)).toThrow(
      expect.objectContaining({ name: 'TokenExpiredError' }),
    );
  });
});
