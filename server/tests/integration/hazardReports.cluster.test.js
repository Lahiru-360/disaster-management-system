import mongoose from 'mongoose';
import request from 'supertest';
import { app } from '../../src/core/App.js';
import { Coordinates } from '../../src/domain/reports/Coordinates.js';
import { ReportStatus } from '../../src/enums/ReportStatus.js';
import { Role } from '../../src/enums/Role.js';
import { HazardReport } from '../../src/models/HazardReport.js';
import { seedAreas } from '../helpers/areaFixtures.js';
import { bearerFor } from '../helpers/authHelper.js';
import { createUser } from '../helpers/userFactory.js';

// UC02 A4 - a possible duplicate joins a cluster (contract §9.2, §9.4-9.5),
// catalogue TC-25…TC-30, through the real app: a new report is POSTed next to
// reports stored earlier, and the officer's queue and detail show the result.
const BRIDGE = { latitude: 6.9382, longitude: 79.9012 };
// MongoDB measures $near on a sphere of radius 6378.1 km.
const northOf = ({ latitude, longitude }, metres) => ({
  latitude: latitude + (metres / 6378100) * (180 / Math.PI),
  longitude,
});
const MINUTE = 60 * 1000;

let areas;
let citizen;
let officer;
let sequence;

beforeAll(async () => {
  await HazardReport.init();
});

beforeEach(async () => {
  areas = await seedAreas();
  citizen = await createUser();
  officer = await createUser({ role: Role.DUTY_OFFICER, shiftDistrict: areas.colombo });
  sequence = 0;
});

// A report stored earlier, as if submitted `minutesAgo` before now.
const storeReport = ({
  location = BRIDGE,
  hazardType = 'RISING_RIVER_FLOOD',
  status = ReportStatus.PENDING,
  minutesAgo = 30,
} = {}) => {
  sequence += 1;
  const id = new mongoose.Types.ObjectId();
  return HazardReport.create({
    _id: id,
    referenceNo: `GR-${String(2400 + sequence)}`,
    reporter: citizen._id,
    description: 'Water rising',
    photoUrl: 'https://example.test/hazard-reports/a.jpg',
    hazardType,
    location: new Coordinates(location).toGeoJSON(),
    locationSource: 'GPS',
    district: areas.colombo._id,
    status,
    submittedAt: new Date(Date.now() - minutesAgo * MINUTE),
    clusterId: id,
  });
};

const submit = (overrides = {}) =>
  request(app)
    .post('/api/hazard-reports')
    .set('Authorization', bearerFor(citizen))
    .send({
      description: 'Water level rising near the bridge',
      hazardType: 'RISING_RIVER_FLOOD',
      location: BRIDGE,
      locationSource: 'GPS',
      photoUrl: 'https://example.supabase.co/storage/v1/object/public/b/hazard-reports/a.jpg',
      ...overrides,
    });

const clusterOf = async (res) => {
  expect(res.status).toBe(201);
  return res.body.data.report.clusterId;
};

describe('POST /api/hazard-reports - clustering (A4)', () => {
  it('A4 (TC-25): same type, 100 m away, 30 min earlier - joins that cluster', async () => {
    const earlier = await storeReport({ location: northOf(BRIDGE, 100), minutesAgo: 30 });

    expect(await clusterOf(await submit())).toBe(earlier.id);
  });

  it.each([
    ['499 m', 499, true],
    ['501 m', 501, false],
  ])('A4 (TC-26): a neighbour %s away - joins: %s', async (_label, metres, joins) => {
    const earlier = await storeReport({ location: northOf(BRIDGE, metres) });

    const clusterId = await clusterOf(await submit());

    expect(clusterId === earlier.id).toBe(joins);
  });

  it.each([
    ['1 h 59 m', 119, true],
    ['2 h 01 m', 121, false],
  ])('A4 (TC-27): a neighbour submitted %s ago - joins: %s', async (_label, minutesAgo, joins) => {
    const earlier = await storeReport({ minutesAgo });

    const clusterId = await clusterOf(await submit());

    expect(clusterId === earlier.id).toBe(joins);
  });

  it.each([ReportStatus.CONFIRMED, ReportStatus.DISMISSED])(
    'A4 (TC-28): a %s neighbour is not matched',
    async (status) => {
      const earlier = await storeReport({ status });

      const res = await submit();

      expect(await clusterOf(res)).not.toBe(earlier.id);
      expect(res.body.data.report.clusterId).toBe(res.body.data.report.id);
    },
  );

  it('A4 (TC-29): a neighbour of a different hazard type is not matched', async () => {
    await storeReport({ hazardType: 'LANDSLIDE' });

    const res = await submit();

    expect(await clusterOf(res)).toBe(res.body.data.report.id);
  });

  it('A4 (TC-30): with two matching clusters, joins the oldest', async () => {
    const older = await storeReport({ location: northOf(BRIDGE, 250), minutesAgo: 90 });
    await storeReport({ location: northOf(BRIDGE, -250), minutesAgo: 20 });

    expect(await clusterOf(await submit())).toBe(older.id);
  });

  it('A4.2: the new report keeps its own reference - it is never discarded', async () => {
    const earlier = await storeReport();

    const res = await submit();

    expect(res.body.data.report.referenceNo).not.toBe(earlier.referenceNo);
    expect(await HazardReport.countDocuments()).toBe(2);
  });

  it('A4.3: the officer sees the cluster in the queue and in the detail', async () => {
    const earlier = await storeReport({ minutesAgo: 40 });
    const res = await submit();
    const newId = res.body.data.report.id;

    const queue = await request(app)
      .get('/api/hazard-reports?status=PENDING')
      .set('Authorization', bearerFor(officer));
    const detail = await request(app)
      .get(`/api/hazard-reports/${newId}`)
      .set('Authorization', bearerFor(officer));

    expect(queue.body.data.clusters).toEqual([
      expect.objectContaining({ clusterId: earlier.id, count: 2 }),
    ]);
    expect(queue.body.data.clusters[0].reports[0].id).toBe(newId);
    expect(detail.body.data.cluster).toMatchObject({
      clusterId: earlier.id,
      count: 2,
      others: [expect.objectContaining({ referenceNo: earlier.referenceNo })],
    });
  });
});
