import mongoose from 'mongoose';
import request from 'supertest';
import { app } from '../../src/core/App.js';
import { Role } from '../../src/enums/Role.js';
import { HazardAlert } from '../../src/models/HazardAlert.js';
import { HazardEvent } from '../../src/models/HazardEvent.js';
import { Notification } from '../../src/models/Notification.js';
import { OccupancyRecord } from '../../src/models/OccupancyRecord.js';
import { Organisation } from '../../src/models/Organisation.js';
import { PostEventReport } from '../../src/models/PostEventReport.js';
import { SupplyDistribution } from '../../src/models/SupplyDistribution.js';
import { seedAreas } from '../helpers/areaFixtures.js';
import { bearerFor } from '../helpers/authHelper.js';
import { createUser } from '../helpers/userFactory.js';

// UC04 A1 (DMS-156, contract §14.12): refining a stored Kelani report with the
// hazard type, district and organisation filters. A FLOOD alert covers
// Colombo and a LANDSLIDE alert Gampaha; both districts have occupancy, and
// Red Cross and UNICEF distributed in Colombo, UNICEF also in Gampaha.
const { ObjectId } = mongoose.Types;
const ALL = ['alertTimeline', 'citizensReached', 'occupancyOverTime', 'resourceDistribution'];
const june = (day) => new Date(`2026-06-${String(day).padStart(2, '0')}T12:00:00.000+05:30`);

let areas;
let officer;
let redCross;
let unicef;
let report;

const alert = async (referenceNo, hazardType, district) => {
  const saved = await HazardAlert.create({
    referenceNo,
    hazardType,
    severity: 'HIGH',
    message: `${hazardType} Warning: HIGH.`,
    status: 'BROADCAST',
    targets: [{ kind: 'District', area: district._id }],
    createdBy: officer._id,
    statusHistory: [{ status: 'BROADCAST', version: 1, at: june(9), by: officer._id }],
  });
  await Notification.create({
    alert: saved._id,
    alertVersion: 1,
    kind: 'WARNING',
    citizen: new ObjectId(),
    channel: 'SMS',
    status: 'DELIVERED',
    sentAt: june(9),
  });
};

const distribution = (organisation, district, quantity) =>
  SupplyDistribution.create({
    shelter: new ObjectId(),
    stock: new ObjectId(),
    organisation: organisation._id,
    supplyType: 'FOOD',
    district: district._id,
    quantity,
    distributedAt: june(10),
    loggedBy: officer._id,
  });

const post = (path, body, user = officer) =>
  request(app).post(path).set('Authorization', bearerFor(user)).send(body);

const refine = (body, id = report.id, user = officer) =>
  post(`/api/post-event-reports/${id}/refine`, body, user);

const section = (res, key) => res.body.data.report.sections.find((s) => s.key === key).result;
const references = (res) => section(res, 'alertTimeline').entries.map((e) => e.alert.referenceNo);
const rows = (res) =>
  section(res, 'resourceDistribution').rows.map(
    (row) => `${row.district.name}/${row.organisation.name}=${row.quantity}`,
  );

beforeEach(async () => {
  areas = await seedAreas();
  officer = await createUser({ role: Role.DMC_OFFICER, name: 'Ruwan Jayasinghe' });
  const event = await HazardEvent.create({
    name: 'Kelani basin floods',
    hazardType: 'FLOOD',
    status: 'CLOSED',
    startDate: new Date('2026-06-08'),
    endDate: new Date('2026-06-20'),
    districts: [areas.colombo._id, areas.gampaha._id],
  });
  await alert('HA-0001', 'FLOOD', areas.colombo);
  await alert('HA-0002', 'LANDSLIDE', areas.gampaha);
  await OccupancyRecord.create(
    [
      [areas.colombo, 120],
      [areas.gampaha, 300],
    ].map(([district, occupants]) => ({
      shelter: new ObjectId(),
      district: district._id,
      occupants,
      capacity: 500,
      recordedAt: june(11),
      recordedBy: officer._id,
    })),
  );
  [redCross, unicef] = await Organisation.create([
    { name: 'Red Cross Sri Lanka', type: 'NGO' },
    { name: 'UNICEF Sri Lanka', type: 'DONOR' },
  ]);
  await distribution(redCross, areas.colombo, 10);
  await distribution(unicef, areas.colombo, 5);
  await distribution(unicef, areas.gampaha, 7);

  const generated = await post('/api/post-event-reports', {
    eventId: String(event._id),
    from: '2026-06-08',
    to: '2026-06-12',
    districtIds: [String(areas.colombo._id), String(areas.gampaha._id)],
    sections: ALL,
  });
  report = generated.body.data.report;
});

describe('POST /api/post-event-reports/:id/refine — filtering', () => {
  it('TC-29 A1: a district filter limits all four sections to that district', async () => {
    const res = await refine({ districtId: String(areas.gampaha._id) });

    expect(res.status).toBe(201);
    expect(references(res)).toEqual(['HA-0002']);
    expect(section(res, 'citizensReached').citizensTargeted).toBe(1);
    expect(section(res, 'occupancyOverTime').districts.map((d) => d.district.name)).toEqual([
      'Gampaha',
    ]);
    expect(rows(res)).toEqual(['Gampaha/UNICEF Sri Lanka=7']);
    expect(res.body.data.report.summary).toEqual(
      expect.objectContaining({ alertsIssued: 1, peakOccupancy: 300, itemsDistributed: 7 }),
    );
    // The report keeps its districts, so the filter can move to another one.
    expect(res.body.data.report.districts.map((d) => d.name)).toEqual(['Colombo', 'Gampaha']);
    expect(res.body.data.report.filters).toEqual({
      hazardType: null,
      districtId: String(areas.gampaha._id),
      organisationId: null,
    });
  });

  it('TC-30 A1: an organisation filter narrows resource distribution only', async () => {
    const res = await refine({ organisationId: String(unicef._id) });

    expect(res.status).toBe(201);
    expect(rows(res)).toEqual(['Colombo/UNICEF Sri Lanka=5', 'Gampaha/UNICEF Sri Lanka=7']);
    expect(res.body.data.report.summary.itemsDistributed).toBe(12);
    expect(references(res)).toEqual(['HA-0001', 'HA-0002']);
    expect(section(res, 'occupancyOverTime')).toEqual(
      report.sections.find((s) => s.key === 'occupancyOverTime').result,
    );
  });

  it('TC-31 A1: a hazard type filter narrows the alert timeline and citizens reached only', async () => {
    const res = await refine({ hazardType: 'LANDSLIDE' });

    expect(res.status).toBe(201);
    expect(references(res)).toEqual(['HA-0002']);
    expect(section(res, 'citizensReached').perAlert.map((row) => row.alert.referenceNo)).toEqual([
      'HA-0002',
    ]);
    expect(rows(res)).toHaveLength(3);
    expect(res.body.data.report.summary.peakOccupancy).toBe(report.summary.peakOccupancy);
  });

  it('TC-32 A1: filters that match nothing in some sections leave them empty, with every day a gap', async () => {
    const res = await refine({
      hazardType: 'CYCLONE',
      districtId: String(areas.gampaha._id),
      organisationId: String(redCross._id),
    });

    // Occupancy isn't narrowed by hazard type or organisation, so Gampaha's
    // occupancy alone keeps the report from being empty (not E2).
    expect(res.status).toBe(201);
    expect(references(res)).toEqual([]);
    expect(rows(res)).toEqual([]);
    expect(res.body.data.report.summary.peakOccupancy).toBe(300);
    expect(res.body.data.report.gaps.map((gap) => [gap.section, gap.from, gap.to])).toEqual(
      expect.arrayContaining([
        ['alertTimeline', '2026-06-08', '2026-06-12'],
        ['resourceDistribution', '2026-06-08', '2026-06-12'],
      ]),
    );
  });

  it('TC-32 A1: when every requested section is empty for the filters, nothing is stored', async () => {
    const narrow = await post('/api/post-event-reports', {
      eventId: report.event.id,
      from: '2026-06-08',
      to: '2026-06-12',
      districtIds: [String(areas.colombo._id), String(areas.gampaha._id)],
      sections: ['alertTimeline', 'resourceDistribution'],
    });
    const before = await PostEventReport.countDocuments();

    const res = await refine(
      {
        hazardType: 'CYCLONE',
        districtId: String(areas.gampaha._id),
        organisationId: String(redCross._id),
      },
      narrow.body.data.report.id,
    );

    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({
      code: 'NO_DATA_FOR_SELECTION',
      message: 'No data is available for this selection.',
    });
    expect(await PostEventReport.countDocuments()).toBe(before);
  });

  it('DMS-156.2: refining a filtered report replaces its filters', async () => {
    const byDistrict = await refine({ districtId: String(areas.gampaha._id) });

    const res = await refine(
      { organisationId: String(unicef._id) },
      byDistrict.body.data.report.id,
    );

    expect(res.body.data.report.filters.districtId).toBeNull();
    expect(rows(res)).toEqual(['Colombo/UNICEF Sri Lanka=5', 'Gampaha/UNICEF Sri Lanka=7']);
  });

  it('DMS-156.2: the report it came from is left as it was', async () => {
    const before = await PostEventReport.findById(report.id).lean();

    await refine({ hazardType: 'FLOOD' });

    expect(await PostEventReport.findById(report.id).lean()).toEqual(before);
  });
});

describe('POST /api/post-event-reports/:id/refine — refused', () => {
  it.each([
    [{}, 'filters', 'must set at least one filter'],
    [{ hazardType: null, districtId: null }, 'filters', 'must set at least one filter'],
    [
      { hazardType: 'TSUNAMI' },
      'hazardType',
      'must be one of [FLOOD, LANDSLIDE, CYCLONE, DROUGHT]',
    ],
    [{ districtId: 'nope' }, 'districtId', 'must be a valid id'],
    [{ organisationId: 'nope' }, 'organisationId', 'must be a valid id'],
  ])('DMS-156.2: %j is refused on %s (400)', async (body, field, message) => {
    const res = await refine(body);

    expect(res.status).toBe(400);
    expect(res.body.error.errors).toEqual([{ field, message }]);
  });

  it("DMS-156.2: a district outside the report's districts is refused (400)", async () => {
    const res = await refine({ districtId: String(areas.kalutara._id) });

    expect(res.status).toBe(400);
    expect(res.body.error.errors).toEqual([
      { field: 'districtId', message: "must be one of the report's districts" },
    ]);
  });

  it('DMS-156.2: an unknown organisation or report is 404 NOT_FOUND', async () => {
    const unknownOrganisation = await refine({ organisationId: String(new ObjectId()) });
    const unknownReport = await refine({ hazardType: 'FLOOD' }, String(new ObjectId()));

    expect([unknownOrganisation.status, unknownOrganisation.body.error.message]).toEqual([
      404,
      'Organisation not found.',
    ]);
    expect([unknownReport.status, unknownReport.body.error.code]).toEqual([404, 'NOT_FOUND']);
  });

  it('DMS-156.2: a report whose hazard event has since been removed is 404 and nothing is stored', async () => {
    await HazardEvent.deleteOne({ _id: report.event.id });
    const before = await PostEventReport.countDocuments();

    const res = await refine({ hazardType: 'FLOOD' });

    expect([res.status, res.body.error.code, res.body.error.message]).toEqual([
      404,
      'NOT_FOUND',
      'Hazard event not found.',
    ]);
    expect(await PostEventReport.countDocuments()).toBe(before);
  });

  it('TC-01 A1: a district officer cannot filter a report (403)', async () => {
    const res = await refine(
      { hazardType: 'FLOOD' },
      report.id,
      await createUser({ role: Role.DISTRICT_OFFICER }),
    );

    expect(res.status).toBe(403);
  });
});
