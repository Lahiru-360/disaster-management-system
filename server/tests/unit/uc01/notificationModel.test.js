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
  it('Domain: a new record is QUEUED with one attempt and no times', async () => {
    const record = await Notification.create(fields());

    expect(record).toMatchObject({
      status: 'QUEUED',
      attempts: 1,
      sentAt: null,
      deliveredAt: null,
      failureReason: null,
    });
  });

  it('Domain: requires the alert, version, kind, citizen and channel', async () => {
    expect(await validationErrorsOf(Notification.create({}))).toEqual([
      'alert',
      'alertVersion',
      'channel',
      'citizen',
      'kind',
    ]);
  });

  it('Domain: refuses values outside the delivery enums', async () => {
    expect(
      await validationErrorsOf(
        Notification.create(fields({ kind: 'REMINDER', channel: 'EMAIL', status: 'LOST' })),
      ),
    ).toEqual(['channel', 'kind', 'status']);
  });

  it('Domain: refuses a version or attempt count below 1', async () => {
    expect(
      await validationErrorsOf(Notification.create(fields({ alertVersion: 0, attempts: 0 }))),
    ).toEqual(['alertVersion', 'attempts']);
  });

  it('Domain: one record per alert version, citizen and channel', async () => {
    const first = await Notification.create(fields());
    const same = { alert: first.alert, citizen: first.citizen };

    await expect(Notification.create(fields(same))).rejects.toMatchObject({ code: 11000 });
    await expect(Notification.create(fields({ ...same, channel: 'SMS' }))).resolves.toBeDefined();
    await expect(Notification.create(fields({ ...same, alertVersion: 2 }))).resolves.toBeDefined();
  });

  it('Domain: toJSON exposes id and drops _id and __v', async () => {
    const json = (await Notification.create(fields())).toJSON();

    expect(json.id).toBeDefined();
    expect(json).not.toHaveProperty('_id');
    expect(json).not.toHaveProperty('__v');
  });

  it('Domain: indexes by alert and status for the summary', () => {
    const indexes = Notification.schema.indexes();

    expect(indexes).toContainEqual([
      { alert: 1, alertVersion: 1, citizen: 1, channel: 1 },
      expect.objectContaining({ unique: true }),
    ]);
    expect(indexes.map(([keys]) => keys)).toContainEqual({ alert: 1, status: 1 });
  });

  it("A3: indexes by alert and citizen for the all-clear's original recipients", () => {
    expect(Notification.schema.indexes().map(([keys]) => keys)).toContainEqual({
      alert: 1,
      citizen: 1,
    });
  });
});
