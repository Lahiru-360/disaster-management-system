import mongoose from 'mongoose';
import { District } from '../../src/models/District.js';
import { User } from '../../src/models/User.js';
import { Role } from '../../src/enums/Role.js';

const userFields = (overrides = {}) => ({
  name: 'Nimal Perera',
  email: 'nimal@example.test',
  passwordHash: 'hash',
  role: Role.CITIZEN,
  ...overrides,
});

const createColombo = () =>
  District.create({
    name: 'Colombo',
    province: 'Western',
    centroid: { lat: 6.9271, lng: 79.8612 },
    bounds: { minLat: 6.75, maxLat: 6.98, minLng: 79.83, maxLng: 80.22 },
  });

beforeAll(async () => {
  await User.init();
});

describe('User model profile fields', () => {
  it('DMS-105: saves a user without any profile field, as accounts did before', async () => {
    const user = await User.create(userFields());

    expect(user.phone).toBeUndefined();
    expect(user.homeDistrict).toBeUndefined();
    expect(user.district).toBeUndefined();
    expect(user.shiftDistrict).toBeUndefined();
  });

  it('DMS-105: stores a trimmed phone and the three district refs', async () => {
    const colombo = await createColombo();
    const user = await User.create(
      userFields({
        phone: '  +94 77 123 4567  ',
        homeDistrict: colombo.id,
        district: colombo.id,
        shiftDistrict: colombo.id,
      }),
    );

    const found = await User.findById(user.id);
    expect(found.phone).toBe('+94 77 123 4567');
    expect(found.homeDistrict.toString()).toBe(colombo.id);
    expect(found.district.toString()).toBe(colombo.id);
    expect(found.shiftDistrict.toString()).toBe(colombo.id);
  });

  it('DMS-105: populates a district ref into the District document', async () => {
    const colombo = await createColombo();
    const user = await User.create(userFields({ homeDistrict: colombo.id }));

    const found = await User.findById(user.id).populate('homeDistrict');
    expect(found.homeDistrict.name).toBe('Colombo');
  });

  it('DMS-105: refuses a district ref that is not an ObjectId', async () => {
    const err = await User.create(userFields({ shiftDistrict: 'Colombo' })).catch((e) => e);

    expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
    expect(Object.keys(err.errors)).toEqual(['shiftDistrict']);
  });

  it('DMS-105: indexes homeDistrict and shiftDistrict', () => {
    const indexedPaths = User.schema.indexes().map(([fields]) => Object.keys(fields)[0]);

    expect(indexedPaths).toEqual(expect.arrayContaining(['homeDistrict', 'shiftDistrict']));
  });

  it('DMS-105: toJSON exposes the profile fields but still hides passwordHash and __v', async () => {
    const colombo = await createColombo();
    const user = await User.create(userFields({ phone: '0771234567', homeDistrict: colombo.id }));

    const json = user.toJSON();
    expect(json).toMatchObject({ phone: '0771234567', homeDistrict: colombo._id });
    expect(json).not.toHaveProperty('passwordHash');
    expect(json).not.toHaveProperty('__v');
  });
});
