import mongoose from 'mongoose';
import { ShelterRedirect } from '../../../src/models/ShelterRedirect.js';

const id = () => new mongoose.Types.ObjectId();

const redirect = (fields = {}) =>
  new ShelterRedirect({
    from: id(),
    to: id(),
    district: id(),
    by: id(),
    at: new Date('2026-10-03T09:31:00.000Z'),
    ...fields,
  });

describe('ShelterRedirect model', () => {
  it('DMS-145.3: accepts a complete redirect', () => {
    expect(redirect().validateSync()).toBeUndefined();
  });

  it.each(['from', 'to', 'district', 'by', 'at'])('DMS-145.3: needs %s', (field) => {
    const error = redirect({ [field]: undefined }).validateSync();

    expect(error.errors[field]).toBeDefined();
  });

  it('DMS-145.3: has no timestamps of its own: at is the time it was made', () => {
    const built = redirect();

    expect(built.createdAt).toBeUndefined();
    expect(built.updatedAt).toBeUndefined();
  });

  it('DMS-145.3: is indexed by the shelter redirected from, then time', () => {
    expect(ShelterRedirect.schema.indexes()).toContainEqual([
      { from: 1, at: 1 },
      expect.anything(),
    ]);
  });

  it('DMS-145.3: shows an id, without the internal fields', () => {
    const json = redirect().toJSON();

    expect(json.id).toBeDefined();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });
});
