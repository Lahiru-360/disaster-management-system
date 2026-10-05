import mongoose from 'mongoose';
import { Notification } from '../../../src/models/Notification.js';
import { DeliverySummary, deliverySummary } from '../../../src/services/DeliverySummary.js';

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

  it('DMS-121: TC-11 counts sent, delivered and failed per channel from the stored records', async () => {
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

  it('DMS-121: a citizen reached on any channel is not unreached', async () => {
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

  it('DMS-121: counts only the requested alert and version', async () => {
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

  it('DMS-121: counts a record retried through the fallback as resent', async () => {
    await Notification.insertMany([
      record(ann, 'PUSH', 'DELIVERED', { attempts: 2 }),
      record(ben, 'PUSH', 'FAILED', { attempts: 3 }),
      record(cara, 'PUSH', 'DELIVERED'),
    ]);

    await expect(deliverySummary.forAlert(alert, 1)).resolves.toMatchObject({
      fallback: { channel: 'SMS', resent: 2 },
    });
  });

  it('DMS-121: nothing sent is every channel at zero, in order', async () => {
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
});
