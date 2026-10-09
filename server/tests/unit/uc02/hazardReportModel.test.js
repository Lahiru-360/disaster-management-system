import mongoose from 'mongoose';
import { DismissalReason } from '../../../src/enums/DismissalReason.js';
import { LocationSource } from '../../../src/enums/LocationSource.js';
import { ReportHazardType } from '../../../src/enums/ReportHazardType.js';
import { ReportStatus } from '../../../src/enums/ReportStatus.js';
import { HazardReport } from '../../../src/models/HazardReport.js';

const reportFields = (overrides = {}) => {
  const id = new mongoose.Types.ObjectId();
  return {
    _id: id,
    referenceNo: 'GR-2481',
    reporter: new mongoose.Types.ObjectId(),
    description: 'Water level rising near the bridge',
    photoUrl: 'https://example.supabase.co/storage/v1/object/public/b/hazard-reports/a.jpg',
    hazardType: ReportHazardType.RISING_RIVER_FLOOD,
    location: { type: 'Point', coordinates: [79.9012, 6.9382] },
    locationSource: LocationSource.GPS,
    district: new mongoose.Types.ObjectId(),
    submittedAt: new Date('2026-10-02T04:54:00.000Z'),
    clusterId: id,
    ...overrides,
  };
};

const validationErrorsOf = async (promise) => {
  const err = await promise.then(
    () => null,
    (error) => error,
  );
  expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
  return Object.keys(err.errors).sort();
};

beforeAll(async () => {
  await HazardReport.init();
});

describe('HazardReport model', () => {
  it('DMS-130: stores a new report as PENDING with no review yet', async () => {
    const report = await HazardReport.create(reportFields());

    expect(report.status).toBe(ReportStatus.PENDING);
    expect(report.reviewedBy).toBeNull();
    expect(report.reviewedAt).toBeNull();
    expect(report.dismissalReason).toBeNull();
    expect(report.dismissalNote).toBeNull();
    expect(report.clientReportId).toBeUndefined();
  });

  it('DMS-130: requires every field the reporter and the server must supply', async () => {
    expect(await validationErrorsOf(HazardReport.create({}))).toEqual([
      'clusterId',
      'description',
      'district',
      'hazardType',
      'location',
      'locationSource',
      'photoUrl',
      'referenceNo',
      'reporter',
      'submittedAt',
    ]);
  });

  it.each([
    ['hazardType', { hazardType: 'FLOOD' }],
    ['locationSource', { locationSource: 'WIFI' }],
    ['status', { status: 'CLOSED' }],
    ['dismissalReason', { dismissalReason: 'SPAM' }],
  ])('DMS-130: refuses a %s outside its enum', async (field, override) => {
    expect(await validationErrorsOf(HazardReport.create(reportFields(override)))).toEqual([field]);
  });

  it('DMS-130: refuses a description over 200 characters, and accepts exactly 200', async () => {
    expect(
      await validationErrorsOf(HazardReport.create(reportFields({ description: 'x'.repeat(201) }))),
    ).toEqual(['description']);

    await expect(
      HazardReport.create(reportFields({ description: 'x'.repeat(200) })),
    ).resolves.toBeDefined();
  });

  it('DMS-130: refuses a dismissal note over 200 characters', async () => {
    expect(
      await validationErrorsOf(
        HazardReport.create(reportFields({ dismissalNote: 'x'.repeat(201) })),
      ),
    ).toEqual(['dismissalNote']);
  });

  it.each([
    ['latitude off the globe', [79.9, 91]],
    ['longitude off the globe', [181, 6.9]],
    ['a missing latitude', [79.9]],
    ['a third coordinate', [79.9, 6.9, 10]],
  ])('DMS-130: refuses a location with %s', async (_label, coordinates) => {
    const errors = await validationErrorsOf(
      HazardReport.create(reportFields({ location: { type: 'Point', coordinates } })),
    );

    expect(errors).toContain('location.coordinates');
  });

  it('DMS-130: refuses a location that is not a GeoJSON Point', async () => {
    const errors = await validationErrorsOf(
      HazardReport.create(
        reportFields({ location: { type: 'Polygon', coordinates: [79.9, 6.9] } }),
      ),
    );

    expect(errors).toContain('location.type');
  });

  it('DMS-130: refuses a second report with the same reference number', async () => {
    await HazardReport.create(reportFields());

    await expect(HazardReport.create(reportFields())).rejects.toMatchObject({ code: 11000 });
  });

  it('DMS-134: refuses a second report with the same clientReportId', async () => {
    const clientReportId = 'b4f0c9e2-6a1d-4c7e-9f3a-2d8e5b7a1c60';
    await HazardReport.create(reportFields({ clientReportId }));

    await expect(
      HazardReport.create(reportFields({ referenceNo: 'GR-2482', clientReportId })),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('DMS-134: allows many reports without a clientReportId (sparse index)', async () => {
    await HazardReport.create(reportFields({ referenceNo: 'GR-0001' }));
    await HazardReport.create(reportFields({ referenceNo: 'GR-0002' }));

    expect(await HazardReport.countDocuments()).toBe(2);
  });

  it('DMS-135: finds a report near a point through the 2dsphere index', async () => {
    await HazardReport.create(reportFields());

    const nearby = await HazardReport.find({
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [79.9015, 6.9385] },
          $maxDistance: 500,
        },
      },
    });

    expect(nearby).toHaveLength(1);
  });

  it('DMS-130: declares the queue index on status, district and submittedAt', () => {
    const indexes = HazardReport.schema.indexes().map(([fields]) => fields);

    expect(indexes).toContainEqual({ status: 1, district: 1, submittedAt: -1 });
    expect(indexes).toContainEqual({ location: '2dsphere' });
  });

  it('DMS-130: serialises to the contract shape, with { latitude, longitude }', async () => {
    const report = await HazardReport.create(reportFields());

    const json = report.toJSON();

    expect(json.id).toEqual(report._id);
    expect(json.location).toEqual({ latitude: 6.9382, longitude: 79.9012 });
    expect(json.clientReportId).toBeNull();
    for (const hidden of ['_id', '__v', 'createdAt', 'updatedAt']) {
      expect(json).not.toHaveProperty(hidden);
    }
  });

  it('DMS-130: serialises a report with no location yet without failing', () => {
    expect(new HazardReport({ referenceNo: 'GR-0001' }).toJSON()).not.toHaveProperty('location');
  });

  it('DMS-130: refuses an empty coordinates array', async () => {
    const errors = await validationErrorsOf(
      HazardReport.create(reportFields({ location: { type: 'Point', coordinates: [] } })),
    );

    expect(errors).toContain('location.coordinates');
  });

  it('DMS-132: stores a dismissal reason from the enum', async () => {
    const report = await HazardReport.create(
      reportFields({
        status: ReportStatus.DISMISSED,
        dismissalReason: DismissalReason.DUPLICATE,
        dismissalNote: 'Same as GR-2479',
      }),
    );

    expect(report.dismissalReason).toBe(DismissalReason.DUPLICATE);
  });
});
