import { AlertHazardType } from '../../src/enums/AlertHazardType.js';
import { EventStatus } from '../../src/enums/EventStatus.js';
import { OrgType } from '../../src/enums/OrgType.js';
import { HazardEvent } from '../../src/models/HazardEvent.js';
import { Organisation } from '../../src/models/Organisation.js';

const DISTRICT_ID = '66f7c1a2b3c4d5e6f7a8b902';

const event = (fields = {}) =>
  new HazardEvent({
    name: 'Kelani basin floods',
    hazardType: AlertHazardType.FLOOD,
    status: EventStatus.CLOSED,
    startDate: new Date('2026-06-08'),
    endDate: new Date('2026-06-20'),
    districts: [DISTRICT_ID],
    ...fields,
  });

// The messages Mongoose collected, by path, or {} when the document is valid.
const errorsOf = async (doc) => {
  try {
    await doc.validate();
    return {};
  } catch (err) {
    return Object.fromEntries(Object.entries(err.errors).map(([path, e]) => [path, e.message]));
  }
};

beforeAll(async () => {
  await HazardEvent.init();
  await Organisation.init();
});

describe('enums', () => {
  it('DMS-107: EventStatus is ACTIVE or CLOSED, and frozen', () => {
    expect(Object.values(EventStatus)).toEqual(['ACTIVE', 'CLOSED']);
    expect(Object.isFrozen(EventStatus)).toBe(true);
  });

  it('DMS-107: OrgType has the five organisation types, and is frozen', () => {
    expect(Object.values(OrgType)).toEqual([
      'GOVERNMENT',
      'ARMED_FORCES',
      'POLICE',
      'NGO',
      'DONOR',
    ]);
    expect(Object.isFrozen(OrgType)).toBe(true);
  });
});

describe('HazardEvent model', () => {
  it('DMS-107: accepts a CLOSED event with an end date and an ACTIVE one without', async () => {
    expect(await errorsOf(event())).toEqual({});
    expect(await errorsOf(event({ status: EventStatus.ACTIVE, endDate: null }))).toEqual({});
  });

  it('DMS-107: defaults endDate to null', () => {
    expect(new HazardEvent({ status: EventStatus.ACTIVE }).endDate).toBeNull();
  });

  it('DMS-107: refuses an end date on an ACTIVE event', async () => {
    expect(await errorsOf(event({ status: EventStatus.ACTIVE }))).toEqual({
      endDate: 'must be null while the event is ACTIVE',
    });
  });

  it('DMS-107: refuses a CLOSED event without an end date', async () => {
    expect(await errorsOf(event({ endDate: null }))).toEqual({
      endDate: 'is required once the event is CLOSED',
    });
  });

  it('DMS-107: refuses an end date before the start date', async () => {
    expect(await errorsOf(event({ endDate: new Date('2026-06-01') }))).toEqual({
      endDate: 'must not be before startDate',
    });
  });

  it('DMS-107: accepts an event that starts and ends on the same day', async () => {
    expect(await errorsOf(event({ endDate: new Date('2026-06-08') }))).toEqual({});
  });

  it('DMS-107: needs at least one district', async () => {
    expect(await errorsOf(event({ districts: [] }))).toEqual({
      districts: 'must list at least one district',
    });
  });

  it('DMS-107: refuses a hazard type outside AlertHazardType and an unknown status', async () => {
    const errors = await errorsOf(event({ hazardType: 'RISING_RIVER_FLOOD', status: 'OPEN' }));

    expect(Object.keys(errors).sort()).toEqual(['hazardType', 'status']);
  });

  it('DMS-107: requires a name, hazard type, start date and status', async () => {
    const errors = await errorsOf(new HazardEvent({ districts: [DISTRICT_ID] }));

    expect(Object.keys(errors).sort()).toEqual(['hazardType', 'name', 'startDate', 'status']);
  });

  it('DMS-107: keeps names unique', async () => {
    await event().save();

    await expect(event().save()).rejects.toMatchObject({ code: 11000 });
  });

  it('DMS-107: serialises with id and without _id or __v', () => {
    const json = event().toJSON();

    expect(json.id).toBeDefined();
    expect(json).not.toHaveProperty('_id');
    expect(json).not.toHaveProperty('__v');
  });
});

describe('Organisation model', () => {
  it('DMS-107: accepts an organisation without a contact email, storing null', async () => {
    const organisation = new Organisation({ name: 'ADRA', type: OrgType.NGO });

    expect(await errorsOf(organisation)).toEqual({});
    expect(organisation.contactEmail).toBeNull();
  });

  it('DMS-107: stores a contact email trimmed and lower-cased', () => {
    const organisation = new Organisation({
      name: 'UNICEF Sri Lanka',
      type: OrgType.DONOR,
      contactEmail: '  Contact@UNICEF.example.test ',
    });

    expect(organisation.contactEmail).toBe('contact@unicef.example.test');
  });

  it('DMS-107: refuses a contact email that is not an address', async () => {
    const organisation = new Organisation({
      name: 'ADRA',
      type: OrgType.NGO,
      contactEmail: 'adra',
    });

    expect(await errorsOf(organisation)).toEqual({ contactEmail: 'must be an email address' });
  });

  it('DMS-107: refuses an unknown type and a missing name', async () => {
    const errors = await errorsOf(new Organisation({ type: 'CHARITY' }));

    expect(Object.keys(errors).sort()).toEqual(['name', 'type']);
  });

  it('DMS-107: keeps names unique', async () => {
    await Organisation.create({ name: 'ADRA', type: OrgType.NGO });

    await expect(Organisation.create({ name: 'ADRA', type: OrgType.DONOR })).rejects.toMatchObject({
      code: 11000,
    });
  });

  it('DMS-107: serialises with id and without _id or __v', () => {
    const json = new Organisation({ name: 'ADRA', type: OrgType.NGO }).toJSON();

    expect(json.id).toBeDefined();
    expect(json).not.toHaveProperty('_id');
    expect(json).not.toHaveProperty('__v');
  });
});
