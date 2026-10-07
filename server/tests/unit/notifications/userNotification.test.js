import mongoose from 'mongoose';
import { NotificationType } from '../../../src/enums/NotificationType.js';
import { UserNotification } from '../../../src/models/UserNotification.js';

const userId = new mongoose.Types.ObjectId();

const confirmedFields = () => ({
  user: userId,
  type: NotificationType.REPORT_CONFIRMED,
  title: 'Report confirmed',
  body: 'Your report GR-2481 was confirmed by the duty officer. Thank you.',
});

const alertFields = () => ({
  user: userId,
  type: NotificationType.HAZARD_ALERT,
  title: 'Flood Warning: SEVERE',
  body: 'Flood Warning: SEVERE. Move to higher ground and follow official guidance.',
  severity: 'SEVERE',
});

const validationErrorsOf = async (promise) => {
  const err = await promise.then(
    () => null,
    (error) => error,
  );
  expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
  return Object.keys(err.errors);
};

describe('NotificationType', () => {
  it("DMS-106: holds exactly the contract's type values", () => {
    expect(Object.values(NotificationType)).toEqual([
      'HAZARD_ALERT',
      'REPORT_SUBMITTED',
      'REPORT_CONFIRMED',
      'REPORT_DISMISSED',
      'ASSIGNMENT',
      'SHELTER_CAPACITY',
      'SUPPORT_REQUEST',
      'DISPATCH_DECLINED',
      'DISPATCH_UNRESPONSIVE',
    ]);
  });

  it('DMS-106: maps each key to the same string and is frozen', () => {
    for (const [key, value] of Object.entries(NotificationType)) {
      expect(value).toBe(key);
    }
    expect(Object.isFrozen(NotificationType)).toBe(true);
  });
});

describe('UserNotification model', () => {
  it('DMS-106: saves an unread item with no link or severity by default', async () => {
    const item = await UserNotification.create(confirmedFields());

    expect(item.readAt).toBeNull();
    expect(item.link).toBeNull();
    expect(item.severity).toBeNull();
    expect(item.createdAt).toBeInstanceOf(Date);
  });

  it('DMS-106: trims the title, body and link', async () => {
    const item = await UserNotification.create({
      ...confirmedFields(),
      title: '  Report confirmed  ',
      body: '  Thank you.  ',
      link: '  /my-reports/1  ',
    });

    expect(item.title).toBe('Report confirmed');
    expect(item.body).toBe('Thank you.');
    expect(item.link).toBe('/my-reports/1');
  });

  it('DMS-106: requires the owner, type, title and body', async () => {
    expect((await validationErrorsOf(UserNotification.create({}))).sort()).toEqual([
      'body',
      'title',
      'type',
      'user',
    ]);
  });

  it('DMS-106: refuses a type outside the NotificationType enum', async () => {
    expect(
      await validationErrorsOf(UserNotification.create({ ...confirmedFields(), type: 'PROMO' })),
    ).toEqual(['type']);
  });

  it('DMS-106: refuses a title over 80 and a body over 500 characters', async () => {
    expect(
      (
        await validationErrorsOf(
          UserNotification.create({
            ...confirmedFields(),
            title: 'x'.repeat(81),
            body: 'x'.repeat(501),
          }),
        )
      ).sort(),
    ).toEqual(['body', 'title']);
  });

  it('DMS-106: accepts the longest title and body', async () => {
    await expect(
      UserNotification.create({
        ...confirmedFields(),
        title: 'x'.repeat(80),
        body: 'x'.repeat(500),
      }),
    ).resolves.toBeDefined();
  });

  it('DMS-106: saves a hazard alert with its severity', async () => {
    const item = await UserNotification.create(alertFields());

    expect(item.severity).toBe('SEVERE');
  });

  it('DMS-106: refuses a hazard alert without a severity', async () => {
    expect(
      await validationErrorsOf(UserNotification.create({ ...alertFields(), severity: null })),
    ).toEqual(['severity']);
  });

  it('DMS-106: refuses a severity on anything but a hazard alert', async () => {
    expect(
      await validationErrorsOf(UserNotification.create({ ...confirmedFields(), severity: 'HIGH' })),
    ).toEqual(['severity']);
  });

  it('DMS-106: refuses a severity outside SeverityLevel', async () => {
    expect(
      await validationErrorsOf(UserNotification.create({ ...alertFields(), severity: 'EXTREME' })),
    ).toEqual(['severity']);
  });

  it('DMS-106: toJSON exposes id and hides the owner, updatedAt and __v', async () => {
    const json = (await UserNotification.create(confirmedFields())).toJSON();

    expect(json.id).toBeDefined();
    expect(json).not.toHaveProperty('_id');
    expect(json).not.toHaveProperty('user');
    expect(json).not.toHaveProperty('updatedAt');
    expect(json).not.toHaveProperty('__v');
    expect(Object.keys(json).sort()).toEqual(
      ['body', 'createdAt', 'id', 'link', 'readAt', 'severity', 'title', 'type'].sort(),
    );
  });

  it('DMS-106: indexes the inbox by owner, newest first, and by read state', () => {
    const indexes = UserNotification.schema.indexes().map(([fields]) => fields);

    expect(indexes).toContainEqual({ user: 1, createdAt: -1, _id: -1 });
    expect(indexes).toContainEqual({ user: 1, readAt: 1 });
  });
});
