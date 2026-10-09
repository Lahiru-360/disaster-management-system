import mongoose from 'mongoose';
import { DispatchStatus } from '../../../src/enums/DispatchStatus.js';
import { Priority } from '../../../src/enums/Priority.js';
import { Dispatch } from '../../../src/models/Dispatch.js';

const dispatch = (fields = {}) =>
  new Dispatch({
    team: new mongoose.Types.ObjectId(),
    district: new mongoose.Types.ObjectId(),
    incident: new mongoose.Types.ObjectId(),
    incidentLocation: { lat: 6.9555, lng: 79.9865, label: 'Biyagama – flooded road' },
    priority: Priority.HIGH,
    createdBy: new mongoose.Types.ObjectId(),
    createdAt: new Date('2026-10-03T09:30:00.000Z'),
    ackDeadline: new Date('2026-10-03T09:35:00.000Z'),
    statusHistory: [{ status: DispatchStatus.ASSIGNED, at: new Date('2026-10-03T09:30:00.000Z') }],
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
  await Dispatch.init();
});

describe('Dispatch model', () => {
  it('Main 9: accepts a dispatch and starts it ASSIGNED, with no decline reason', async () => {
    const doc = dispatch();

    expect(await errorsOf(doc)).toEqual({});
    expect(doc.status).toBe(DispatchStatus.ASSIGNED);
    expect(doc.declineReason).toBeNull();
    expect(doc.statusHistory[0].by).toBeNull();
  });

  it('Main 9: requires team, district, incident, location, priority, creator and createdAt', async () => {
    const errors = await errorsOf(new Dispatch({}));

    expect(Object.keys(errors).sort()).toEqual([
      'createdAt',
      'createdBy',
      'district',
      'incident',
      'incidentLocation.lat',
      'incidentLocation.lng',
      'priority',
      'team',
    ]);
  });

  it('E3: an UNASSIGNED dispatch needs no team or deadline, and asks for no support by default', async () => {
    const doc = dispatch({
      team: undefined,
      status: DispatchStatus.UNASSIGNED,
      ackDeadline: undefined,
    });

    expect(await errorsOf(doc)).toEqual({});
    expect(doc.team).toBeNull();
    expect(doc.ackDeadline).toBeNull();
    expect(doc.supportRequested).toBe(false);
  });

  it('E3: only an UNASSIGNED dispatch may go without a team', async () => {
    for (const status of Object.values(DispatchStatus).filter(
      (s) => s !== DispatchStatus.UNASSIGNED,
    )) {
      expect(Object.keys(await errorsOf(dispatch({ team: undefined, status })))).toEqual(['team']);
    }
  });

  it('Main 6: refuses a priority or status outside its enum, and a location off the globe', async () => {
    const errors = await errorsOf(
      dispatch({ priority: 'URGENT', status: 'LOST', incidentLocation: { lat: 91, lng: 0 } }),
    );

    expect(Object.keys(errors).sort()).toEqual(['incidentLocation.lat', 'priority', 'status']);
  });

  it('Main 9: keeps the createdAt it is given rather than the save time', async () => {
    const saved = await dispatch().save();

    expect(saved.createdAt).toEqual(new Date('2026-10-03T09:30:00.000Z'));
    expect(saved.updatedAt).toBeInstanceOf(Date);
  });

  it('Main 9: indexes a team’s open dispatch, a district’s list and the deadline scan', async () => {
    const keys = (await Dispatch.listIndexes()).map((index) => index.key);

    expect(keys).toEqual(
      expect.arrayContaining([
        { team: 1, status: 1 },
        { district: 1, createdAt: -1 },
        { status: 1, ackDeadline: 1 },
      ]),
    );
  });

  it('Main 9: serialises with id and without _id or __v', () => {
    const json = dispatch().toJSON();

    expect(json.id).toBeDefined();
    expect(json).not.toHaveProperty('_id');
    expect(json).not.toHaveProperty('__v');
  });
});
