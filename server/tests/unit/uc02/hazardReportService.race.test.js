import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { Coordinates } from '../../../src/domain/reports/Coordinates.js';
import { ReportAlreadyReviewedError } from '../../../src/domain/reports/ReportAlreadyReviewedError.js';
import { ReportStatus } from '../../../src/enums/ReportStatus.js';
import { Role } from '../../../src/enums/Role.js';
import { HazardReport } from '../../../src/models/HazardReport.js';
import { HazardReportService } from '../../../src/services/HazardReportService.js';
import { FakeClock } from '../../helpers/FakeClock.js';
import { seedAreas } from '../../helpers/areaFixtures.js';
import { createUser } from '../../helpers/userFactory.js';

// UC02 E3 at the moment of writing (DMS-138.1): the report was PENDING when
// loaded, but a colleague reviewed it before this officer's update landed.
// The conditional update must lose and report the status it lost to.
afterEach(() => {
  jest.restoreAllMocks();
});

it('E3: a review whose conditional update loses the race throws with the winning status', async () => {
  const areas = await seedAreas();
  const officer = await createUser({ role: Role.DUTY_OFFICER, shiftDistrict: areas.colombo });
  const notifyUser = jest.fn();
  const service = new HazardReportService({
    clock: new FakeClock(),
    notifications: { notifyUser },
  });
  const id = new mongoose.Types.ObjectId();
  await HazardReport.create({
    _id: id,
    referenceNo: 'GR-2481',
    reporter: new mongoose.Types.ObjectId(),
    description: 'Water rising',
    photoUrl: 'https://example.test/hazard-reports/a.jpg',
    hazardType: 'RISING_RIVER_FLOOD',
    location: new Coordinates({ latitude: 6.9382, longitude: 79.9012 }).toGeoJSON(),
    locationSource: 'GPS',
    district: areas.colombo._id,
    submittedAt: new Date(),
    clusterId: id,
  });

  // The colleague's dismissal lands between this officer's read and write.
  const write = HazardReport.findOneAndUpdate.bind(HazardReport);
  jest.spyOn(HazardReport, 'findOneAndUpdate').mockImplementationOnce(async (...args) => {
    await HazardReport.updateOne({ _id: id }, { status: ReportStatus.DISMISSED });
    return write(...args);
  });

  const error = await service.confirm(String(id), officer).catch((err) => err);

  expect(error).toBeInstanceOf(ReportAlreadyReviewedError);
  expect(error.currentStatus).toBe('DISMISSED');
  expect((await HazardReport.findById(id)).status).toBe('DISMISSED');
  expect(notifyUser).not.toHaveBeenCalled();
});
