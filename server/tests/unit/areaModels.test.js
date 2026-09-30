import mongoose from 'mongoose';
import { District } from '../../src/models/District.js';
import { RiverBasin } from '../../src/models/RiverBasin.js';

const colomboFields = () => ({
  name: 'Colombo',
  province: 'Western',
  centroid: { lat: 6.9271, lng: 79.8612 },
  bounds: { minLat: 6.75, maxLat: 6.98, minLng: 79.83, maxLng: 80.22 },
});

const validationErrorsOf = async (promise) => {
  const err = await promise.then(
    () => null,
    (error) => error,
  );
  expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
  return Object.keys(err.errors);
};

// The unique indexes are built in the background; wait for them before
// relying on a duplicate being refused.
beforeAll(async () => {
  await District.init();
  await RiverBasin.init();
});

describe('District model', () => {
  it('DMS-104: saves a district, trims its name and stamps timestamps', async () => {
    const district = await District.create({ ...colomboFields(), name: '  Colombo  ' });

    expect(district.name).toBe('Colombo');
    expect(district.createdAt).toBeInstanceOf(Date);
    expect(district.updatedAt).toBeInstanceOf(Date);
  });

  it('DMS-104: refuses a second district with the same name', async () => {
    await District.create(colomboFields());

    await expect(District.create(colomboFields())).rejects.toMatchObject({ code: 11000 });
  });

  it('DMS-104: refuses a province outside the Province enum', async () => {
    expect(
      await validationErrorsOf(District.create({ ...colomboFields(), province: 'Atlantis' })),
    ).toEqual(['province']);
  });

  it('DMS-104: requires a centroid and a box', async () => {
    const { name, province } = colomboFields();

    expect((await validationErrorsOf(District.create({ name, province }))).sort()).toEqual([
      'bounds.maxLat',
      'bounds.maxLng',
      'bounds.minLat',
      'bounds.minLng',
      'centroid.lat',
      'centroid.lng',
    ]);
  });

  it('DMS-104: refuses coordinates off the globe', async () => {
    const fields = { ...colomboFields(), centroid: { lat: 91, lng: 181 } };

    expect((await validationErrorsOf(District.create(fields))).sort()).toEqual([
      'centroid.lat',
      'centroid.lng',
    ]);
  });

  it.each([
    ['latitude', { minLat: 7, maxLat: 6 }, 'bounds.maxLat'],
    ['longitude', { minLng: 81, maxLng: 80 }, 'bounds.maxLng'],
  ])('DMS-104: refuses a box with its %s edges swapped on save', async (_label, swap, field) => {
    const fields = colomboFields();
    fields.bounds = { ...fields.bounds, ...swap };

    expect(await validationErrorsOf(District.create(fields))).toEqual([field]);
  });

  it('DMS-104: accepts a box of zero width, with equal edges', async () => {
    const fields = colomboFields();
    fields.bounds = { minLat: 6.9, maxLat: 6.9, minLng: 79.9, maxLng: 79.9 };

    await expect(District.create(fields)).resolves.toBeDefined();
  });

  it('DMS-104: refuses a swapped box in an upsert with runValidators, the way the seeder writes', async () => {
    const fields = colomboFields();
    fields.bounds = { ...fields.bounds, minLat: 7, maxLat: 6 };

    const update = District.updateOne(
      { name: 'Colombo' },
      { $set: fields },
      { upsert: true, runValidators: true },
    );

    expect(await validationErrorsOf(update)).toEqual(['bounds.maxLat']);
  });

  it('DMS-104: refuses swapped edges set by dotted paths in an update', async () => {
    await District.create(colomboFields());

    const update = District.updateOne(
      { name: 'Colombo' },
      { $set: { 'bounds.minLng': 81, 'bounds.maxLng': 80 } },
      { runValidators: true },
    );

    expect(await validationErrorsOf(update)).toEqual(['bounds.maxLng']);
  });

  it('DMS-104: accepts an update that moves only one edge, which it cannot check against the other', async () => {
    await District.create(colomboFields());

    await District.updateOne(
      { name: 'Colombo' },
      { $set: { 'bounds.maxLat': 6.97 } },
      { runValidators: true },
    );

    expect((await District.findOne({ name: 'Colombo' })).bounds.maxLat).toBe(6.97);
  });

  it('DMS-104: serialises with id instead of _id, and without __v', async () => {
    const json = (await District.create(colomboFields())).toJSON();

    expect(Object.keys(json).sort()).toEqual([
      'bounds',
      'centroid',
      'createdAt',
      'id',
      'name',
      'province',
      'updatedAt',
    ]);
    expect(Object.keys(json.centroid).sort()).toEqual(['lat', 'lng']);
  });
});

describe('RiverBasin model', () => {
  it('DMS-104: saves a basin spanning districts', async () => {
    const colombo = await District.create(colomboFields());

    const basin = await RiverBasin.create({ name: 'Kelani', districts: [colombo._id] });

    expect(basin.districts.map(String)).toEqual([String(colombo._id)]);
    expect(basin.createdAt).toBeInstanceOf(Date);
  });

  it('DMS-104: refuses a second basin with the same name', async () => {
    const colombo = await District.create(colomboFields());
    await RiverBasin.create({ name: 'Kelani', districts: [colombo._id] });

    await expect(
      RiverBasin.create({ name: 'Kelani', districts: [colombo._id] }),
    ).rejects.toMatchObject({
      code: 11000,
    });
  });

  it.each([
    ['an empty list', { districts: [] }],
    ['no list', {}],
  ])('DMS-104: refuses a basin with %s of districts', async (_label, fields) => {
    expect(await validationErrorsOf(RiverBasin.create({ name: 'Empty', ...fields }))).toEqual([
      'districts',
    ]);
  });

  it('DMS-104: refuses a basin that names the same district twice', async () => {
    const colombo = await District.create(colomboFields());

    expect(
      await validationErrorsOf(
        RiverBasin.create({ name: 'Twice', districts: [colombo._id, colombo._id] }),
      ),
    ).toEqual(['districts']);
  });

  it('DMS-104: serialises populated districts as { id, name } only', async () => {
    const colombo = await District.create(colomboFields());
    await RiverBasin.create({ name: 'Kelani', districts: [colombo._id] });

    const basin = await RiverBasin.findOne({ name: 'Kelani' }).populate({
      path: 'districts',
      select: 'name',
    });
    const json = JSON.parse(JSON.stringify(basin));

    expect(json.districts).toEqual([{ id: String(colombo._id), name: 'Colombo' }]);
    expect(json).not.toHaveProperty('_id');
    expect(json).not.toHaveProperty('__v');
  });
});
