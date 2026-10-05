import mongoose from 'mongoose';
import { Coordinates } from '../../../src/domain/reports/Coordinates.js';
import { HazardReport } from '../../../src/domain/reports/HazardReport.js';
import { ReportAlreadyReviewedError } from '../../../src/domain/reports/ReportAlreadyReviewedError.js';
import { DismissalReason } from '../../../src/enums/DismissalReason.js';
import { LocationSource } from '../../../src/enums/LocationSource.js';
import { ReportHazardType } from '../../../src/enums/ReportHazardType.js';
import { ReportStatus } from '../../../src/enums/ReportStatus.js';
import { HazardReport as HazardReportModel } from '../../../src/models/HazardReport.js';
import { ApiError } from '../../../src/utils/ApiError.js';

const AT = new Date('2026-10-02T05:01:00.000Z');
const OFFICER_ID = '64f1a2b3c4d5e6f7a8b9c0d9';

const pendingReport = (overrides = {}) =>
  new HazardReport({
    id: '66f9a0c1b2c3d4e5f6a7b801',
    referenceNo: 'GR-2481',
    reporter: '64f1a2b3c4d5e6f7a8b9c0d1',
    description: 'Water level rising near the bridge',
    photoUrl: 'https://example.test/hazard-reports/a.jpg',
    hazardType: ReportHazardType.RISING_RIVER_FLOOD,
    location: { latitude: 6.9382, longitude: 79.9012 },
    locationSource: LocationSource.GPS,
    district: '66f7c1a2b3c4d5e6f7a8b901',
    submittedAt: new Date('2026-10-02T04:54:00.000Z'),
    clusterId: '66f9a0c1b2c3d4e5f6a7b801',
    ...overrides,
  });

describe('Coordinates', () => {
  it('DMS-130: keeps latitude and longitude and converts to GeoJSON [lng, lat]', () => {
    const point = new Coordinates({ latitude: 6.9382, longitude: 79.9012 });

    expect(point.latitude).toBe(6.9382);
    expect(point.longitude).toBe(79.9012);
    expect(point.toGeoJSON()).toEqual({ type: 'Point', coordinates: [79.9012, 6.9382] });
    expect(point.toJSON()).toEqual({ latitude: 6.9382, longitude: 79.9012 });
    expect(point.toPoint()).toEqual({ lat: 6.9382, lng: 79.9012 });
  });

  it('DMS-130: reads a GeoJSON Point back in the right order', () => {
    const point = Coordinates.fromGeoJSON({ type: 'Point', coordinates: [79.9012, 6.9382] });

    expect(point.toJSON()).toEqual({ latitude: 6.9382, longitude: 79.9012 });
  });

  it.each([
    ['latitude', { latitude: 91, longitude: 79.9 }],
    ['latitude', { latitude: undefined, longitude: 79.9 }],
    ['longitude', { latitude: 6.9, longitude: -181 }],
    ['longitude', { latitude: 6.9, longitude: Number.NaN }],
  ])('DMS-130: refuses an invalid %s', (field, point) => {
    expect(() => new Coordinates(point)).toThrow(new RegExp(field));
  });

  it('DMS-130: refuses being built with nothing', () => {
    expect(() => new Coordinates()).toThrow(RangeError);
  });
});

describe('HazardReport domain', () => {
  describe('a new report', () => {
    it('DMS-130: starts PENDING, unreviewed and not escalatable', () => {
      const report = pendingReport({ status: undefined });

      expect(report.status).toBe(ReportStatus.PENDING);
      expect(report.reviewedById).toBeNull();
      expect(report.reviewedAt).toBeNull();
      expect(report.isEscalatable()).toBe(false);
    });

    it('DMS-130: exposes its fields, with the location as Coordinates', () => {
      const report = pendingReport();

      expect(report).toMatchObject({
        id: '66f9a0c1b2c3d4e5f6a7b801',
        referenceNo: 'GR-2481',
        reporterId: '64f1a2b3c4d5e6f7a8b9c0d1',
        description: 'Water level rising near the bridge',
        photoUrl: 'https://example.test/hazard-reports/a.jpg',
        hazardType: ReportHazardType.RISING_RIVER_FLOOD,
        locationSource: LocationSource.GPS,
        districtId: '66f7c1a2b3c4d5e6f7a8b901',
        clusterId: '66f9a0c1b2c3d4e5f6a7b801',
        dismissalReason: null,
        dismissalNote: null,
      });
      expect(report.submittedAt).toEqual(new Date('2026-10-02T04:54:00.000Z'));
      expect(report.location).toBeInstanceOf(Coordinates);
    });

    it('DMS-130: refuses a status outside ReportStatus', () => {
      expect(() => pendingReport({ status: 'CLOSED' })).toThrow('unknown status "CLOSED"');
    });
  });

  describe('confirm (steps 12-13)', () => {
    it('DMS-131: becomes CONFIRMED, records the officer and time, and is escalatable', () => {
      const report = pendingReport();

      report.confirm({ id: OFFICER_ID }, AT);

      expect(report.status).toBe(ReportStatus.CONFIRMED);
      expect(report.reviewedById).toBe(OFFICER_ID);
      expect(report.reviewedAt).toBe(AT);
      expect(report.isEscalatable()).toBe(true);
    });

    it('DMS-131: takes the officer as a document with an ObjectId _id, or a bare id', () => {
      const objectId = new mongoose.Types.ObjectId(OFFICER_ID);
      const fromDoc = pendingReport();
      const fromId = pendingReport();

      fromDoc.confirm({ _id: objectId }, AT);
      fromId.confirm(objectId, AT);

      expect(fromDoc.reviewedById).toBe(OFFICER_ID);
      expect(fromId.reviewedById).toBe(OFFICER_ID);
    });

    it('DMS-131: gives the review changes for the conditional update', () => {
      const report = pendingReport();

      report.confirm(OFFICER_ID, AT);

      expect(report.reviewChanges()).toEqual({
        status: ReportStatus.CONFIRMED,
        reviewedBy: OFFICER_ID,
        reviewedAt: AT,
        dismissalReason: null,
        dismissalNote: null,
      });
    });

    it('DMS-131: refuses a review with no officer', () => {
      expect(() => pendingReport().confirm(null, AT)).toThrow('needs the reviewing officer');
    });

    it.each([
      ['no time', undefined],
      ['an invalid date', new Date('nope')],
      ['a string', '2026-10-02'],
    ])('DMS-131: refuses a review with %s', (_label, at) => {
      expect(() => pendingReport().confirm(OFFICER_ID, at)).toThrow('needs the time');
    });

    it('DMS-131: leaves the report PENDING when a review is refused', () => {
      const report = pendingReport();

      expect(() => report.confirm(null, AT)).toThrow();

      expect(report.status).toBe(ReportStatus.PENDING);
      expect(report.reviewedAt).toBeNull();
    });
  });

  describe('dismiss (A1)', () => {
    it.each(Object.values(DismissalReason))(
      'DMS-132: becomes DISMISSED with reason %s and is not escalatable',
      (reason) => {
        const report = pendingReport();

        report.dismiss(OFFICER_ID, reason, 'Same as GR-2479', AT);

        expect(report.status).toBe(ReportStatus.DISMISSED);
        expect(report.dismissalReason).toBe(reason);
        expect(report.dismissalNote).toBe('Same as GR-2479');
        expect(report.reviewedById).toBe(OFFICER_ID);
        expect(report.reviewedAt).toBe(AT);
        expect(report.isEscalatable()).toBe(false);
      },
    );

    it.each([
      ['no note', undefined],
      ['a blank note', '   '],
    ])('DMS-132: stores %s as null', (_label, note) => {
      const report = pendingReport();

      report.dismiss(OFFICER_ID, DismissalReason.INACCURATE, note, AT);

      expect(report.dismissalNote).toBeNull();
    });

    it('DMS-132: accepts a 200-character note and refuses 201', () => {
      pendingReport().dismiss(OFFICER_ID, DismissalReason.INACCURATE, 'x'.repeat(200), AT);

      expect(() =>
        pendingReport().dismiss(OFFICER_ID, DismissalReason.INACCURATE, 'x'.repeat(201), AT),
      ).toThrow('over 200 characters');
    });

    it.each([undefined, 'SPAM'])('DMS-132: refuses reason %s', (reason) => {
      const report = pendingReport();

      expect(() => report.dismiss(OFFICER_ID, reason, null, AT)).toThrow(
        'unknown dismissal reason',
      );
      expect(report.status).toBe(ReportStatus.PENDING);
    });
  });

  describe('already reviewed (E3)', () => {
    it.each([
      ['confirm', ReportStatus.CONFIRMED, (r) => r.confirm(OFFICER_ID, AT)],
      ['confirm', ReportStatus.DISMISSED, (r) => r.confirm(OFFICER_ID, AT)],
      ['dismiss', ReportStatus.CONFIRMED, (r) => r.dismiss(OFFICER_ID, 'DUPLICATE', null, AT)],
      ['dismiss', ReportStatus.DISMISSED, (r) => r.dismiss(OFFICER_ID, 'DUPLICATE', null, AT)],
    ])('DMS-138: refuses to %s a %s report and names its status', (_action, status, act) => {
      const report = pendingReport({ status });

      let error;
      try {
        act(report);
      } catch (err) {
        error = err;
      }

      expect(error).toBeInstanceOf(ReportAlreadyReviewedError);
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({
        status: 409,
        code: 'REPORT_ALREADY_REVIEWED',
        currentStatus: status,
        message: `Already reviewed – current status: ${status}`,
      });
      expect(report.status).toBe(status);
    });

    it('DMS-138: a second confirm keeps the first reviewer', () => {
      const report = pendingReport();
      report.confirm(OFFICER_ID, AT);

      expect(() => report.confirm('64f1a2b3c4d5e6f7a8b9c0aa', new Date())).toThrow(
        ReportAlreadyReviewedError,
      );
      expect(report.reviewedById).toBe(OFFICER_ID);
      expect(report.reviewedAt).toBe(AT);
    });
  });

  describe('fromDocument', () => {
    const storedFields = () => {
      const id = new mongoose.Types.ObjectId();
      return {
        _id: id,
        referenceNo: 'GR-2481',
        reporter: new mongoose.Types.ObjectId(),
        description: 'Water level rising near the bridge',
        photoUrl: 'https://example.test/hazard-reports/a.jpg',
        hazardType: ReportHazardType.RISING_RIVER_FLOOD,
        location: { type: 'Point', coordinates: [79.9012, 6.9382] },
        locationSource: LocationSource.GPS,
        district: new mongoose.Types.ObjectId(),
        submittedAt: new Date('2026-10-02T04:54:00.000Z'),
        clusterId: id,
      };
    };

    it('DMS-130: builds from a saved document, with ids as strings', async () => {
      const doc = await HazardReportModel.create(storedFields());

      const report = HazardReport.fromDocument(doc);

      expect(report.id).toBe(doc.id);
      expect(report.clusterId).toBe(doc.id);
      expect(report.districtId).toBe(String(doc.district));
      expect(report.location.toJSON()).toEqual({ latitude: 6.9382, longitude: 79.9012 });
      expect(report.status).toBe(ReportStatus.PENDING);
    });

    it('DMS-130: builds from a lean object too', () => {
      const fields = storedFields();

      const report = HazardReport.fromDocument(fields);

      expect(report.id).toBe(String(fields._id));
      expect(report.location).toBeInstanceOf(Coordinates);
    });

    it('DMS-130: keeps a location already given as { latitude, longitude }', () => {
      const report = HazardReport.fromDocument({
        id: 'abc',
        location: { latitude: 6.9, longitude: 79.9 },
      });

      expect(report.location.toPoint()).toEqual({ lat: 6.9, lng: 79.9 });
    });

    it('DMS-130: allows a document with no location', () => {
      expect(HazardReport.fromDocument({ id: 'abc' }).location).toBeUndefined();
    });
  });
});
