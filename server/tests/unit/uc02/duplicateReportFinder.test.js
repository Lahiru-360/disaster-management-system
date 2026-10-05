import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { Coordinates } from '../../../src/domain/reports/Coordinates.js';
import { LocationSource } from '../../../src/enums/LocationSource.js';
import { ReportHazardType } from '../../../src/enums/ReportHazardType.js';
import { ReportStatus } from '../../../src/enums/ReportStatus.js';
import { HazardReport } from '../../../src/models/HazardReport.js';
import {
  DuplicateReportFinder,
  duplicateReportFinder,
} from '../../../src/services/DuplicateReportFinder.js';

// UC02 A4 query (DMS-135.1). The 2-hour window is passed in as `since`, as the
// service will (clock.now() minus 2 h), so these fix it explicitly.
const NOW = new Date('2026-10-02T06:00:00.000Z');
const TWO_HOURS_AGO = new Date(NOW.getTime() - 2 * 60 * 60 * 1000);
const BRIDGE = { latitude: 6.9382, longitude: 79.9012 };

// MongoDB measures $near distances on a sphere of radius 6378.1 km, so a point
// `metres` due north is this many degrees of latitude away.
const MONGO_EARTH_RADIUS_METRES = 6378100;
const northOf = ({ latitude, longitude }, metres) => ({
  latitude: latitude + (metres / MONGO_EARTH_RADIUS_METRES) * (180 / Math.PI),
  longitude,
});

let sequence = 0;
const storeReport = ({
  location = BRIDGE,
  hazardType = ReportHazardType.RISING_RIVER_FLOOD,
  status = ReportStatus.PENDING,
  submittedAt = new Date(NOW.getTime() - 30 * 60 * 1000),
} = {}) => {
  sequence += 1;
  const id = new mongoose.Types.ObjectId();
  return HazardReport.create({
    _id: id,
    referenceNo: `GR-${String(sequence).padStart(4, '0')}`,
    reporter: new mongoose.Types.ObjectId(),
    description: 'Water rising',
    photoUrl: 'https://example.test/hazard-reports/a.jpg',
    hazardType,
    location: new Coordinates(location).toGeoJSON(),
    locationSource: LocationSource.GPS,
    district: new mongoose.Types.ObjectId(),
    status,
    submittedAt,
    clusterId: id,
  });
};

const find = (location = BRIDGE, hazardType = ReportHazardType.RISING_RIVER_FLOOD) =>
  duplicateReportFinder.findNearbyPending(location, hazardType, TWO_HOURS_AGO);

beforeAll(async () => {
  await HazardReport.init();
});

describe('DuplicateReportFinder.findNearbyPending (UC02 A4)', () => {
  it('A4 (TC-25): finds a PENDING report of the same type 100 m away, 30 min old', async () => {
    const existing = await storeReport({ location: northOf(BRIDGE, 100) });

    const matches = await find();

    expect(matches).toHaveLength(1);
    expect(String(matches[0]._id)).toBe(existing.id);
    expect(String(matches[0].clusterId)).toBe(existing.id);
    expect(matches[0].referenceNo).toBe(existing.referenceNo);
    expect(matches[0].submittedAt).toEqual(existing.submittedAt);
  });

  it('Main 7: finds nothing when there are no reports', async () => {
    expect(await find()).toEqual([]);
  });

  it('A4 (TC-26): matches at 499 m and not at 501 m', async () => {
    const inside = await storeReport({ location: northOf(BRIDGE, 499) });
    await storeReport({ location: northOf(BRIDGE, 501) });

    const matches = await find();

    expect(matches.map((m) => String(m._id))).toEqual([inside.id]);
  });

  it('A4 (TC-27): matches a report 1 h 59 m old and not one 2 h 01 m old', async () => {
    const recent = await storeReport({ submittedAt: new Date(NOW.getTime() - 119 * 60 * 1000) });
    await storeReport({ submittedAt: new Date(NOW.getTime() - 121 * 60 * 1000) });

    const matches = await find();

    expect(matches.map((m) => String(m._id))).toEqual([recent.id]);
  });

  it('A4: includes a report submitted exactly at the start of the window', async () => {
    await storeReport({ submittedAt: TWO_HOURS_AGO });

    expect(await find()).toHaveLength(1);
  });

  it.each([ReportStatus.CONFIRMED, ReportStatus.DISMISSED])(
    'A4 (TC-28): ignores a %s neighbour',
    async (status) => {
      await storeReport({ status });

      expect(await find()).toEqual([]);
    },
  );

  it('A4 (TC-29): ignores a neighbour of a different hazard type', async () => {
    await storeReport({ hazardType: ReportHazardType.LANDSLIDE });

    expect(await find()).toEqual([]);
  });

  it('A4: returns every match, nearest first', async () => {
    const far = await storeReport({ location: northOf(BRIDGE, 400) });
    const near = await storeReport({ location: northOf(BRIDGE, 50) });

    const matches = await find();

    expect(matches.map((m) => String(m._id))).toEqual([near.id, far.id]);
  });

  it('A4: takes the location as Coordinates too', async () => {
    await storeReport();

    const matches = await duplicateReportFinder.findNearbyPending(
      new Coordinates(BRIDGE),
      ReportHazardType.RISING_RIVER_FLOOD,
      TWO_HOURS_AGO,
    );

    expect(matches).toHaveLength(1);
  });

  it('A4: queries the model it was given', async () => {
    const lean = jest.fn().mockResolvedValue([]);
    const select = jest.fn(() => ({ lean }));
    const reportModel = { find: jest.fn(() => ({ select })) };

    await new DuplicateReportFinder({ reportModel }).findNearbyPending(
      BRIDGE,
      ReportHazardType.OTHER,
      TWO_HOURS_AGO,
    );

    expect(reportModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        status: ReportStatus.PENDING,
        hazardType: ReportHazardType.OTHER,
        submittedAt: { $gte: TWO_HOURS_AGO },
      }),
    );
  });
});
