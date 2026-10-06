import mongoose from 'mongoose';
import { Notification } from '../../../src/models/Notification.js';
import { DeliverySummary, deliverySummary } from '../../../src/services/DeliverySummary.js';
import { FallbackPolicy } from '../../../src/domain/alerts/FallbackPolicy.js';
import { seedAreas } from '../../helpers/areaFixtures.js';
import { createUser } from '../../helpers/userFactory.js';

const id = () => new mongoose.Types.ObjectId();

describe('DeliverySummary', () => {
  const alert = id();
  const [ann, ben, cara] = [id(), id(), id()];

  // One delivery record; every field but the ones given is a plain default.
  const record = (citizen, channel, status, fields = {}) => ({
    alert,
    alertVersion: 1,
    kind: 'WARNING',
    citizen,
    channel,
    status,
    ...fields,
  });

  it('Main 14: TC-11 counts sent, delivered and failed per channel from the stored records', async () => {
    await Notification.insertMany([
      record(ann, 'PUSH', 'DELIVERED'),
      record(ben, 'PUSH', 'FAILED', { failureReason: 'offline' }),
      record(cara, 'PUSH', 'SENT'),
      record(ann, 'SMS', 'DELIVERED'),
      record(ben, 'SMS', 'DELIVERED'),
      record(cara, 'SMS', 'QUEUED'),
      record(ann, 'AUDIBLE', 'FAILED'),
    ]);

    const summary = await deliverySummary.forAlert(alert.toString(), 1);

    expect(summary).toEqual({
      version: 1,
      perChannel: [
        { channel: 'PUSH', sent: 3, delivered: 1, failed: 1 },
        { channel: 'SMS', sent: 2, delivered: 2, failed: 0 },
        { channel: 'AUDIBLE', sent: 1, delivered: 0, failed: 1 },
      ],
      totals: { sent: 6, delivered: 3, failed: 2 },
      fallback: { channel: 'SMS', resent: 0 },
      unreachedCount: 1,
    });
  });

  it('Main 14: a citizen reached on any channel is not unreached', async () => {
    await Notification.insertMany([
      record(ann, 'PUSH', 'FAILED'),
      record(ann, 'SMS', 'DELIVERED'),
      record(ben, 'PUSH', 'FAILED'),
      record(ben, 'SMS', 'FAILED'),
    ]);

    await expect(deliverySummary.forAlert(alert, 1)).resolves.toMatchObject({
      unreachedCount: 1,
    });
  });

  it('Main 14: counts only the requested alert and version', async () => {
    await Notification.insertMany([
      record(ann, 'PUSH', 'DELIVERED'),
      record(ann, 'PUSH', 'DELIVERED', { alertVersion: 2, kind: 'UPDATE' }),
      record(ben, 'PUSH', 'DELIVERED', { alertVersion: 2, kind: 'UPDATE' }),
      { ...record(ann, 'PUSH', 'DELIVERED'), alert: id() },
    ]);

    const first = await deliverySummary.forAlert(alert, 1);
    const second = await deliverySummary.forAlert(alert, 2);

    expect(first.totals.delivered).toBe(1);
    expect(second).toMatchObject({ version: 2, totals: { sent: 2, delivered: 2, failed: 0 } });
  });

  it('E3: counts a record retried through the fallback as resent', async () => {
    await Notification.insertMany([
      record(ann, 'PUSH', 'DELIVERED', { attempts: 2, fallbackChannel: 'SMS' }),
      record(ben, 'PUSH', 'FAILED', { attempts: 3, fallbackChannel: 'SMS' }),
      record(cara, 'PUSH', 'DELIVERED'),
    ]);

    await expect(deliverySummary.forAlert(alert, 1)).resolves.toMatchObject({
      fallback: { channel: 'SMS', resent: 2 },
    });
  });

  it('Main 14: nothing sent is every channel at zero, in order', async () => {
    const summary = await new DeliverySummary().forAlert(id(), 1);

    expect(summary).toEqual({
      version: 1,
      perChannel: ['PUSH', 'SMS', 'AUDIBLE'].map((channel) => ({
        channel,
        sent: 0,
        delivered: 0,
        failed: 0,
      })),
      totals: { sent: 0, delivered: 0, failed: 0 },
      fallback: { channel: 'SMS', resent: 0 },
      unreachedCount: 0,
    });
  });

  it("E3: reports the injected policy's fallback channel", async () => {
    const summary = await new DeliverySummary({
      fallback: new FallbackPolicy({ channel: 'PUSH' }),
    }).forAlert(id(), 1);

    expect(summary.fallback).toEqual({ channel: 'PUSH', resent: 0 });
  });

  describe('unreachedCitizens (E3.3)', () => {
    let areas;
    let people;
    const PAGE = { page: 1, limit: 20 };

    // Zara in Colombo with a phone, Asha in Gampaha without, Malan in Colombo.
    beforeEach(async () => {
      areas = await seedAreas();
      people = {
        zara: await createUser({
          name: 'Zara Fernando',
          homeDistrict: areas.colombo,
          phone: '+94771111111',
        }),
        asha: await createUser({ name: 'Asha Silva', homeDistrict: areas.gampaha }),
        malan: await createUser({
          name: 'Malan Perera',
          homeDistrict: areas.colombo,
          phone: '+94772222222',
        }),
      };
    });

    it('E3: TC-42 lists the distinct citizens with no DELIVERED record, by name, with district and phone', async () => {
      const { zara, asha, malan } = people;
      await Notification.insertMany([
        record(zara._id, 'PUSH', 'FAILED'),
        record(zara._id, 'SMS', 'FAILED'),
        record(zara._id, 'AUDIBLE', 'SENT'),
        record(asha._id, 'PUSH', 'FAILED'),
        record(asha._id, 'SMS', 'FAILED'),
        record(malan._id, 'PUSH', 'DELIVERED'),
      ]);

      const result = await deliverySummary.unreachedCitizens(alert, 1, PAGE);

      expect(result).toEqual({
        citizens: [
          {
            id: asha.id,
            name: 'Asha Silva',
            district: { id: areas.gampaha.id, name: 'Gampaha' },
            phone: null,
          },
          {
            id: zara.id,
            name: 'Zara Fernando',
            district: { id: areas.colombo.id, name: 'Colombo' },
            phone: '+94771111111',
          },
        ],
        total: 2,
      });
    });

    it('E3: TC-41 a citizen delivered by audible while push failed is not unreached', async () => {
      const { zara } = people;
      await Notification.insertMany([
        record(zara._id, 'PUSH', 'FAILED', { attempts: 3, fallbackChannel: 'SMS' }),
        record(zara._id, 'SMS', 'FAILED', { attempts: 3, fallbackChannel: 'SMS' }),
        record(zara._id, 'AUDIBLE', 'DELIVERED'),
      ]);

      await expect(deliverySummary.unreachedCitizens(alert, 1, PAGE)).resolves.toEqual({
        citizens: [],
        total: 0,
      });
      await expect(deliverySummary.forAlert(alert, 1)).resolves.toMatchObject({
        unreachedCount: 0,
      });
    });

    it('E3: pages by name then id without overlap; the total matches unreachedCount', async () => {
      await Notification.insertMany(
        Object.values(people).map((person) => record(person._id, 'PUSH', 'FAILED')),
      );

      const first = await deliverySummary.unreachedCitizens(alert, 1, { page: 1, limit: 2 });
      const second = await deliverySummary.unreachedCitizens(alert, 1, { page: 2, limit: 2 });
      const past = await deliverySummary.unreachedCitizens(alert, 1, { page: 3, limit: 2 });

      expect(first.citizens.map((c) => c.name)).toEqual(['Asha Silva', 'Malan Perera']);
      expect(second.citizens.map((c) => c.name)).toEqual(['Zara Fernando']);
      expect(past).toEqual({ citizens: [], total: 3 });
      expect(first.total).toBe(3);
      expect((await deliverySummary.forAlert(alert, 1)).unreachedCount).toBe(3);
    });

    it('E3: counts only the requested alert and version', async () => {
      const { zara, asha } = people;
      await Notification.insertMany([
        record(zara._id, 'PUSH', 'FAILED', { alertVersion: 2 }),
        record(asha._id, 'PUSH', 'FAILED', { alert: id() }),
        record(asha._id, 'PUSH', 'DELIVERED'),
      ]);

      await expect(deliverySummary.unreachedCitizens(alert, 1, PAGE)).resolves.toEqual({
        citizens: [],
        total: 0,
      });
      await expect(deliverySummary.unreachedCitizens(alert, 2, PAGE)).resolves.toMatchObject({
        total: 1,
      });
    });
  });
});
