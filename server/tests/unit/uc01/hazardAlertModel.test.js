import mongoose from 'mongoose';
import { District } from '../../../src/models/District.js';
import { HazardAlert } from '../../../src/models/HazardAlert.js';
import { RiverBasin } from '../../../src/models/RiverBasin.js';

const officerId = new mongoose.Types.ObjectId();
const AT = new Date('2026-10-02T06:20:00.000Z');

const draftFields = (fields = {}) => ({
  referenceNo: 'HA-1043',
  createdBy: officerId,
  statusHistory: [{ status: 'DRAFT', version: 1, at: AT, by: officerId }],
  ...fields,
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
  await HazardAlert.init();
});

describe('HazardAlert model', () => {
  it('DMS-120: a new draft is DRAFT, version 1, with nothing composed yet', async () => {
    const alert = await HazardAlert.create(draftFields());

    expect(alert).toMatchObject({
      status: 'DRAFT',
      version: 1,
      hazardType: null,
      severity: null,
      message: null,
      event: null,
      sourceReport: null,
      issuedBy: null,
      issuedAt: null,
    });
    expect(alert.targets).toHaveLength(0);
    expect(alert.statusHistory[0].toObject()).toEqual({
      status: 'DRAFT',
      version: 1,
      at: AT,
      by: officerId,
    });
    expect(alert.createdAt).toBeInstanceOf(Date);
  });

  it('DMS-120: stores a composed draft with district and basin targets', async () => {
    const targets = [
      { kind: 'District', area: new mongoose.Types.ObjectId() },
      { kind: 'RiverBasin', area: new mongoose.Types.ObjectId() },
    ];

    const alert = await HazardAlert.create(
      draftFields({
        hazardType: 'FLOOD',
        severity: 'SEVERE',
        message: '  Flood Warning: SEVERE. Move to higher ground.  ',
        targets,
      }),
    );

    expect(alert.message).toBe('Flood Warning: SEVERE. Move to higher ground.');
    expect(alert.targets.map((target) => target.toObject())).toEqual(targets);
  });

  it('DMS-120: requires a reference number and its creator', async () => {
    expect(await validationErrorsOf(HazardAlert.create({ statusHistory: [] }))).toEqual([
      'createdBy',
      'referenceNo',
    ]);
  });

  it('DMS-120: refuses a second alert with the same reference number', async () => {
    await HazardAlert.create(draftFields());

    await expect(HazardAlert.create(draftFields())).rejects.toMatchObject({ code: 11000 });
  });

  it('DMS-120: refuses values outside the alert enums', async () => {
    expect(
      await validationErrorsOf(
        HazardAlert.create(
          draftFields({ hazardType: 'RISING_RIVER_FLOOD', severity: 'EXTREME', status: 'SENT' }),
        ),
      ),
    ).toEqual(['hazardType', 'severity', 'status']);
  });

  it('DMS-120: accepts a 160-character message and refuses 161', async () => {
    await expect(
      HazardAlert.create(draftFields({ message: 'x'.repeat(160) })),
    ).resolves.toBeDefined();

    expect(
      await validationErrorsOf(
        HazardAlert.create(draftFields({ referenceNo: 'HA-1044', message: 'x'.repeat(161) })),
      ),
    ).toEqual(['message']);
  });

  it('DMS-120: refuses a target that is neither a District nor a RiverBasin, or has no area', async () => {
    expect(
      await validationErrorsOf(
        HazardAlert.create(
          draftFields({
            targets: [
              { kind: 'Province', area: new mongoose.Types.ObjectId() },
              { kind: 'District' },
            ],
          }),
        ),
      ),
    ).toEqual(['targets.0.kind', 'targets.1.area']);
  });

  it('DMS-120: refuses a version below 1 and an incomplete history entry', async () => {
    expect(
      await validationErrorsOf(
        HazardAlert.create(
          draftFields({ version: 0, statusHistory: [{ status: 'DRAFT', version: 1 }] }),
        ),
      ),
    ).toEqual(['statusHistory.0.at', 'statusHistory.0.by', 'version']);
  });

  it('DMS-120: populates each target from its own collection by kind', async () => {
    const colombo = await District.create({
      name: 'Colombo',
      province: 'Western',
      centroid: { lat: 6.9271, lng: 79.8612 },
      bounds: { minLat: 6.75, maxLat: 6.98, minLng: 79.83, maxLng: 80.22 },
    });
    const kelani = await RiverBasin.create({ name: 'Kelani', districts: [colombo._id] });
    const { id } = await HazardAlert.create(
      draftFields({
        targets: [
          { kind: 'District', area: colombo._id },
          { kind: 'RiverBasin', area: kelani._id },
        ],
      }),
    );

    const alert = await HazardAlert.findById(id).populate('targets.area', 'name');

    expect(alert.targets.map((target) => [target.kind, target.area.name])).toEqual([
      ['District', 'Colombo'],
      ['RiverBasin', 'Kelani'],
    ]);
  });

  it('DMS-120: toJSON exposes id and drops _id and __v', async () => {
    const json = (await HazardAlert.create(draftFields())).toJSON();

    expect(json.id).toBeDefined();
    expect(json).not.toHaveProperty('_id');
    expect(json).not.toHaveProperty('__v');
    expect(json.referenceNo).toBe('HA-1043');
  });

  it('DMS-120: indexes by status and type, and by targeted area', () => {
    const indexes = HazardAlert.schema.indexes().map(([fields]) => fields);

    expect(indexes).toContainEqual({ status: 1, hazardType: 1 });
    expect(indexes).toContainEqual({ 'targets.area': 1 });
  });
});
