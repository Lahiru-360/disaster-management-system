import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { LocationSource } from '../../../src/enums/LocationSource.js';
import { ReportStatus } from '../../../src/enums/ReportStatus.js';
import { Role } from '../../../src/enums/Role.js';
import { HazardAlert } from '../../../src/models/HazardAlert.js';
import { HazardReport } from '../../../src/models/HazardReport.js';
import { WarningService } from '../../../src/services/WarningService.js';
import { FakeClock } from '../../helpers/FakeClock.js';
import { seedAreas } from '../../helpers/areaFixtures.js';
import { createUser } from '../../helpers/userFactory.js';

// UC01 A1 (DMS-122): escalating a confirmed hazard report to a warning.
const NOW = '2026-10-02T06:20:00.000Z';

// Points inside one fixture district's box, and one far from all of them.
const IN_COLOMBO = [79.9012, 6.9382];
const IN_GAMPAHA = [79.9999, 7.0917];
const IN_JAFFNA = [80.0255, 9.6615];

describe('WarningService escalation (A1)', () => {
  let service;
  let officer;
  let areas;
  let reporter;
  let counter = 2480;

  beforeEach(async () => {
    service = new WarningService({ clock: new FakeClock(NOW) });
    areas = await seedAreas();
    officer = await createUser({ role: Role.DUTY_OFFICER, shiftDistrict: areas.colombo });
    reporter = await createUser({ homeDistrict: areas.colombo });
  });

  const createReport = ({
    status = ReportStatus.CONFIRMED,
    hazardType = 'RISING_RIVER_FLOOD',
    coordinates = IN_COLOMBO,
    district = areas.colombo,
  } = {}) => {
    const id = new mongoose.Types.ObjectId();
    counter += 1;
    return HazardReport.create({
      _id: id,
      referenceNo: `GR-${counter}`,
      reporter: reporter._id,
      description: 'Water level rising near the bridge',
      photoUrl: 'https://example.supabase.co/storage/v1/object/public/b/hazard-reports/a.jpg',
      hazardType,
      location: { type: 'Point', coordinates },
      locationSource: LocationSource.GPS,
      district: district._id,
      submittedAt: new Date('2026-10-02T04:54:00.000Z'),
      clusterId: id,
      status,
      ...(status === ReportStatus.PENDING
        ? {}
        : { reviewedBy: officer._id, reviewedAt: new Date('2026-10-02T05:01:00.000Z') }),
      ...(status === ReportStatus.DISMISSED ? { dismissalReason: 'NOT_A_HAZARD' } : {}),
    });
  };

  describe('escalateFromReport', () => {
    it('A1: TC-16 a CONFIRMED rising-river report gives a DRAFT linked to it, pre-filled FLOOD in its district', async () => {
      const report = await createReport();

      const { alert, prefill } = await service.escalateFromReport(officer, report.id);

      expect(prefill).toEqual({
        hazardType: 'FLOOD',
        districtId: areas.colombo.id,
        reportRef: { id: report.id, referenceNo: report.referenceNo },
      });
      expect(alert).toMatchObject({
        status: 'DRAFT',
        version: 1,
        hazardType: null,
        severity: null,
        targets: [],
        sourceReport: { id: report.id, referenceNo: report.referenceNo },
        createdBy: { id: officer.id, name: officer.name },
      });
      const stored = await HazardAlert.findById(alert.id);
      expect(String(stored.sourceReport)).toBe(report.id);
    });

    it('A1: TC-16 the escalated draft continues through the main flow from step 4', async () => {
      const report = await createReport();
      const { alert, prefill } = await service.escalateFromReport(officer, report.id);

      const preview = await service.preview(alert.id, {
        hazardType: prefill.hazardType,
        severity: 'HIGH',
        areaIds: [prefill.districtId],
      });

      expect(preview.alert).toMatchObject({
        hazardType: 'FLOOD',
        severity: 'HIGH',
        targets: [{ kind: 'District', id: areas.colombo.id }],
        sourceReport: { id: report.id },
      });
    });

    it('A1: TC-16 a LANDSLIDE report pre-fills LANDSLIDE', async () => {
      const report = await createReport({ hazardType: 'LANDSLIDE' });

      const { prefill } = await service.escalateFromReport(officer, report.id);

      expect(prefill.hazardType).toBe('LANDSLIDE');
    });

    it.each(['BLOCKED_ROAD', 'OTHER'])(
      'A1: TC-17 a %s report leaves the hazard type for the officer to choose',
      async (hazardType) => {
        const report = await createReport({ hazardType });

        const { alert, prefill } = await service.escalateFromReport(officer, report.id);

        expect(prefill.hazardType).toBeNull();
        expect(prefill.districtId).toBe(areas.colombo.id);
        expect(alert.sourceReport.id).toBe(report.id);
      },
    );

    it.each([ReportStatus.PENDING, ReportStatus.DISMISSED])(
      'A1: TC-18 a %s report is refused with 409 and no draft is created',
      async (status) => {
        const report = await createReport({ status });

        await expect(service.escalateFromReport(officer, report.id)).rejects.toMatchObject({
          status: 409,
          code: 'REPORT_NOT_ESCALATABLE',
          message: `Only a confirmed report can be escalated – current status: ${status}`,
        });
        expect(await HazardAlert.countDocuments()).toBe(0);
      },
    );

    it.each([
      ['an unknown id', () => new mongoose.Types.ObjectId().toString()],
      ['a malformed id', () => 'not-an-id'],
    ])('A1: TC-19 %s is 404 and no draft is created', async (_label, idFor) => {
      await expect(service.escalateFromReport(officer, idFor())).rejects.toMatchObject({
        status: 404,
        code: 'NOT_FOUND',
        message: 'Hazard report not found.',
      });
      expect(await HazardAlert.countDocuments()).toBe(0);
    });
  });

  describe('prefillFromReport', () => {
    it('A1: takes the district from the coordinates, not the district the report was filed under', async () => {
      const report = await createReport({ coordinates: IN_GAMPAHA, district: areas.kalutara });

      const prefill = await service.prefillFromReport(report.id);

      expect(prefill.districtId).toBe(areas.gampaha.id);
    });

    it('A1: falls back to the filed district when no district is near the coordinates', async () => {
      const report = await createReport({ coordinates: IN_JAFFNA, district: areas.kalutara });

      const prefill = await service.prefillFromReport(report.id);

      expect(prefill.districtId).toBe(areas.kalutara.id);
    });

    it('A1: reads the report only through the injected report service (X-1)', async () => {
      const report = {
        id: 'r1',
        referenceNo: 'GR-0001',
        hazardType: 'LANDSLIDE',
        location: { latitude: 6.9382, longitude: 79.9012 },
        district: { id: 'd-filed', name: 'Filed' },
        status: ReportStatus.CONFIRMED,
        isEscalatable: true,
      };
      const reportService = { findById: jest.fn().mockResolvedValue(report) };
      const areaRegistry = { findDistrictForPoint: jest.fn().mockResolvedValue(null) };
      const isolated = new WarningService({ reportService, areaRegistry });

      await expect(isolated.prefillFromReport('r1')).resolves.toEqual({
        hazardType: 'LANDSLIDE',
        districtId: 'd-filed',
        reportRef: { id: 'r1', referenceNo: 'GR-0001' },
      });
      expect(reportService.findById).toHaveBeenCalledWith('r1');
      expect(areaRegistry.findDistrictForPoint).toHaveBeenCalledWith(6.9382, 79.9012);
    });
  });
});
