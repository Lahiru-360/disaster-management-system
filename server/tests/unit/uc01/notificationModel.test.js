import mongoose from 'mongoose';
import { Notification } from '../../../src/models/Notification.js';

const fields = (overrides = {}) => ({
  alert: new mongoose.Types.ObjectId(),
  alertVersion: 1,
  kind: 'WARNING',
  citizen: new mongoose.Types.ObjectId(),
  channel: 'PUSH',
  ...overrides,
});

const validationErrorsOf = async (promise) => {
  const err = await promise.then(
    () => null,
    (error) => error,
  );
  expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
  return Object.keys(err.errors).sort();
};

// The unique index is built in the background; wait for it before relying on
// a duplicate being refused.
beforeAll(async () => {
  await Notification.init();
});

describe('Notification model (delivery record)', () => {
  it('DMS-121: a new record is QUEUED with one attempt and no times', async () => {
    const record = await Notification.create(fields());

    expect(record).toMatchObject({
      status: 'QUEUED',
      attempts: 1,
      sentAt: null,
      deliveredAt: null,
      failureReason: null,
    });
  });

  it('DMS-121: requires the alert, version, kind, citizen and channel', async () => {
    expect(await validationErrorsOf(Notification.create({}))).toEqual([
      'alert',
      'alertVersion',
      'channel',
      'citizen',
      'kind',
    ]);
  });

  it('DMS-121: refuses values outside the delivery enums', async () => {
    expect(
      await validationErrorsOf(
        Notification.create(fields({ kind: 'REMINDER', channel: 'EMAIL', status: 'LOST' })),
      ),
    ).toEqual(['channel', 'kind', 'status']);
  });

  it('DMS-121: refuses a version or attempt count below 1', async () => {
    expect(
      await validationErrorsOf(Notification.create(fields({ alertVersion: 0, attempts: 0 }))),
    ).toEqual(['alertVersion', 'attempts']);
  });

  it('DMS-121: one record per alert version, citizen and channel', async () => {
    const first = await Notification.create(fields());
    const same = { alert: first.alert, citizen: first.citizen };

    await expect(Notification.create(fields(same))).rejects.toMatchObject({ code: 11000 });
    await expect(Notification.create(fields({ ...same, channel: 'SMS' }))).resolves.toBeDefined();
    await expect(Notification.create(fields({ ...same, alertVersion: 2 }))).resolves.toBeDefined();
  });

  it('DMS-121: toJSON exposes id and drops _id and __v', async () => {
    const json = (await Notification.create(fields())).toJSON();

    expect(json.id).toBeDefined();
    expect(json).not.toHaveProperty('_id');
    expect(json).not.toHaveProperty('__v');
  });

  it('DMS-121: indexes by alert and status for the summary', () => {
    const indexes = Notification.schema.indexes();

    expect(indexes).toContainEqual([
      { alert: 1, alertVersion: 1, citizen: 1, channel: 1 },
      expect.objectContaining({ unique: true }),
    ]);
    expect(indexes.map(([keys]) => keys)).toContainEqual({ alert: 1, status: 1 });
  });
});
