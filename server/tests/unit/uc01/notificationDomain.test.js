import mongoose from 'mongoose';
import { Notification } from '../../../src/domain/alerts/Notification.js';
import { Notification as NotificationModel } from '../../../src/models/Notification.js';

const SENT_AT = new Date('2026-10-02T06:31:00.000Z');
const LATER = new Date('2026-10-02T06:31:05.000Z');

const queued = (overrides = {}) =>
  new Notification({
    alert: 'a1',
    alertVersion: 1,
    kind: 'WARNING',
    citizen: 'c1',
    channel: 'PUSH',
    ...overrides,
  });

describe('Notification (domain)', () => {
  it('DMS-121: starts QUEUED with one attempt', () => {
    const notification = queued();

    expect(notification.status).toBe('QUEUED');
    expect(notification.attempts).toBe(1);
    expect(notification.isFinal()).toBe(false);
  });

  it('DMS-121: markDelivered from QUEUED sets sentAt and deliveredAt', () => {
    const notification = queued();

    notification.markDelivered(SENT_AT);

    expect(notification.deliveryChanges()).toEqual({
      status: 'DELIVERED',
      attempts: 1,
      fallbackChannel: null,
      sentAt: SENT_AT,
      deliveredAt: SENT_AT,
      failureReason: null,
    });
    expect(notification.isFinal()).toBe(true);
  });

  it('DMS-121: SENT then DELIVERED keeps the first sentAt', () => {
    const notification = queued();

    notification.markSent(SENT_AT);
    notification.markDelivered(LATER);

    expect(notification).toMatchObject({
      status: 'DELIVERED',
      sentAt: SENT_AT,
      deliveredAt: LATER,
    });
  });

  it('DMS-121: markFailed records the reason', () => {
    const notification = queued();

    notification.markFailed('gateway down', SENT_AT);

    expect(notification).toMatchObject({
      status: 'FAILED',
      failureReason: 'gateway down',
      sentAt: SENT_AT,
      deliveredAt: null,
    });
  });

  it('DMS-121: a failure without a reason still says why', () => {
    const notification = queued({ status: 'SENT', sentAt: SENT_AT });

    notification.markFailed(undefined, LATER);

    expect(notification.failureReason).toBe('Delivery failed');
    expect(notification.sentAt).toBe(SENT_AT);
  });

  it.each([
    ['DELIVERED', (n) => n.markFailed('late', LATER)],
    ['DELIVERED', (n) => n.markDelivered(LATER)],
    ['FAILED', (n) => n.markDelivered(LATER)],
    ['FAILED', (n) => n.markSent(LATER)],
    ['SENT', (n) => n.markSent(LATER)],
  ])('DMS-121: refuses a change from %s', (status, change) => {
    const notification = queued({ status, sentAt: SENT_AT });

    expect(() => change(notification)).toThrow(`cannot go from ${status}`);
  });

  it('DMS-121: refuses an unknown status', () => {
    expect(() => queued({ status: 'LOST' })).toThrow('unknown status "LOST"');
  });

  it('DMS-121: fromDocument reads a stored record, ids as strings', async () => {
    const alert = new mongoose.Types.ObjectId();
    const citizen = new mongoose.Types.ObjectId();
    const doc = await NotificationModel.create({
      alert,
      alertVersion: 2,
      kind: 'UPDATE',
      citizen,
      channel: 'SMS',
    });

    const notification = Notification.fromDocument(doc);

    expect(notification).toMatchObject({
      id: doc.id,
      alertId: alert.toString(),
      alertVersion: 2,
      kind: 'UPDATE',
      citizenId: citizen.toString(),
      channel: 'SMS',
      status: 'QUEUED',
    });
  });

  it('DMS-121: fromDocument accepts a plain object with populated refs', () => {
    const notification = Notification.fromDocument({
      id: 'n1',
      alert: { id: 'a9' },
      citizen: { _id: 'c9' },
      alertVersion: 1,
      kind: 'WARNING',
      channel: 'AUDIBLE',
    });

    expect(notification).toMatchObject({ id: 'n1', alertId: 'a9', citizenId: 'c9' });
    expect(queued({ citizen: null }).citizenId).toBeNull();
  });

  it('DMS-128: TC-39 resendVia counts the attempt and records the fallback channel', () => {
    const notification = queued();

    notification.resendVia('SMS');
    notification.markDelivered(SENT_AT);

    expect(notification.deliveryChanges()).toEqual({
      status: 'DELIVERED',
      attempts: 2,
      fallbackChannel: 'SMS',
      sentAt: SENT_AT,
      deliveredAt: SENT_AT,
      failureReason: null,
    });
    expect(notification.channel).toBe('PUSH');
  });

  it('DMS-128: TC-40 two resends then a failure is FAILED after 3 attempts', () => {
    const notification = queued();

    notification.resendVia('SMS');
    notification.resendVia('SMS');
    notification.markFailed('SMS gateway did not accept the message', SENT_AT);

    expect(notification).toMatchObject({
      status: 'FAILED',
      attempts: 3,
      fallbackChannel: 'SMS',
      failureReason: 'SMS gateway did not accept the message',
    });
  });

  it.each([
    ['SENT', (n) => n.markSent(SENT_AT)],
    ['DELIVERED', (n) => n.markDelivered(SENT_AT)],
    ['FAILED', (n) => n.markFailed('offline', SENT_AT)],
  ])('DMS-128: refuses to resend a %s delivery', (status, mark) => {
    const notification = queued();
    mark(notification);

    expect(() => notification.resendVia('SMS')).toThrow(`cannot resend a ${status} delivery`);
    expect(notification.attempts).toBe(1);
  });

  it('DMS-128: fromDocument keeps attempts and the fallback channel', async () => {
    const doc = await NotificationModel.create({
      alert: new mongoose.Types.ObjectId(),
      alertVersion: 1,
      kind: 'WARNING',
      citizen: new mongoose.Types.ObjectId(),
      channel: 'PUSH',
      status: 'FAILED',
      attempts: 3,
      fallbackChannel: 'SMS',
    });

    expect(Notification.fromDocument(doc)).toMatchObject({ attempts: 3, fallbackChannel: 'SMS' });
  });

  it('DMS-128: a new record has no fallback channel, and refuses one that is not a Channel', async () => {
    const fields = {
      alert: new mongoose.Types.ObjectId(),
      alertVersion: 1,
      kind: 'WARNING',
      citizen: new mongoose.Types.ObjectId(),
      channel: 'PUSH',
    };

    expect((await NotificationModel.create(fields)).fallbackChannel).toBeNull();
    await expect(
      NotificationModel.create({ ...fields, channel: 'SMS', fallbackChannel: 'EMAIL' }),
    ).rejects.toThrow(/fallbackChannel/);
  });
});
