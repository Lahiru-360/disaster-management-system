import mongoose from 'mongoose';
import request from 'supertest';
import { app } from '../../src/core/App.js';
import { Role } from '../../src/enums/Role.js';
import { HazardAlert } from '../../src/models/HazardAlert.js';
import { HazardEvent } from '../../src/models/HazardEvent.js';
import { Notification } from '../../src/models/Notification.js';
import { Organisation } from '../../src/models/Organisation.js';
import { PostEventReport } from '../../src/models/PostEventReport.js';
import { SupplyDistribution } from '../../src/models/SupplyDistribution.js';
import { OccupancyRecordRepository } from '../../src/services/reports/repositories/OccupancyRecordRepository.js';
import { seedAreas } from '../helpers/areaFixtures.js';
import { bearerFor } from '../helpers/authHelper.js';
import { createUser } from '../helpers/userFactory.js';

// UC04 main flow steps 4-11 (DMS-153.6, contract §14.3-14.5) against a small
// Kelani history: one alert, two deliveries, two occupancy records and one
// distribution.
const { ObjectId } = mongoose.Types;
const ALL = ['alertTimeline', 'citizensReached', 'occupancyOverTime', 'resourceDistribution'];
const june = (day, time = '12:00') =>
  new Date(`2026-06-${String(day).padStart(2, '0')}T${time}:00.000+05:30`);

let areas;
let event;
let officer;

const seedKelani = async () => {
  areas = await seedAreas();
  officer = await createUser({ role: Role.DMC_OFFICER, name: 'Ruwan Jayasinghe' });
  event = await HazardEvent.create({
    name: 'Kelani basin floods',
    hazardType: 'FLOOD',
    status: 'CLOSED',
    startDate: new Date('2026-06-08'),
    endDate: new Date('2026-06-20'),
    districts: [areas.colombo._id, areas.gampaha._id, areas.kalutara._id],
  });

  const alert = await HazardAlert.create({
    referenceNo: 'HA-0001',
    hazardType: 'FLOOD',
    severity: 'HIGH',
    message: 'Flood Warning: HIGH.',
    status: 'BROADCAST',
    targets: [{ kind: 'District', area: areas.colombo._id }],
    event: event._id,
    createdBy: officer._id,
    statusHistory: [{ status: 'BROADCAST', version: 1, at: june(9), by: officer._id }],
  });
  await Notification.create(
    ['DELIVERED', 'FAILED'].map((status) => ({
      alert: alert._id,
      alertVersion: 1,
      kind: 'WARNING',
      citizen: new ObjectId(),
      channel: 'SMS',
      status,
      sentAt: june(9),
    })),
  );
  await mongoose.connection.collection(OccupancyRecordRepository.COLLECTION).insertMany([
    { shelter: new ObjectId(), district: areas.gampaha._id, occupants: 300, recordedAt: june(12) },
    { shelter: new ObjectId(), district: areas.colombo._id, occupants: 120, recordedAt: june(12) },
  ]);
  const unicef = await Organisation.create({ name: 'UNICEF Sri Lanka', type: 'DONOR' });
  await SupplyDistribution.create({
    shelter: new ObjectId(),
    stock: new ObjectId(),
    organisation: unicef._id,
    supplyType: 'HYGIENE_KITS',
    district: areas.kalutara._id,
    quantity: 150,
    distributedAt: june(13),
    loggedBy: officer._id,
  });
};

const kelaniBody = (fields = {}) => ({
  eventId: String(event._id),
  from: '2026-06-08',
  to: '2026-06-20',
  districtIds: [areas.colombo, areas.gampaha, areas.kalutara].map((d) => String(d._id)),
  sections: ALL,
  ...fields,
});

const generate = (body, user = officer) =>
  request(app).post('/api/post-event-reports').set('Authorization', bearerFor(user)).send(body);

const get = (path, user = officer) => request(app).get(path).set('Authorization', bearerFor(user));

const fieldsOf = (res) => res.body.error.errors.map((error) => error.field).sort();

beforeEach(async () => {
  await seedKelani();
});

describe('POST /api/post-event-reports — access', () => {
  it.each([Role.DISTRICT_OFFICER, Role.CITIZEN, Role.RESCUE_TEAM_LEAD])(
    'TC-01 Main 1: a %s cannot generate a report (403)',
    async (role) => {
      const res = await generate(kelaniBody(), await createUser({ role }));

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(await PostEventReport.countDocuments()).toBe(0);
    },
  );

  it('TC-01 Main 1: without a token the request is refused (401)', async () => {
    const res = await request(app).post('/api/post-event-reports').send(kelaniBody());

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_HEADER_MISSING');
  });

  it('DMS-153.6: a duty officer is a DMC officer, so may generate one', async () => {
    const res = await generate(kelaniBody(), await createUser({ role: Role.DUTY_OFFICER }));

    expect(res.status).toBe(201);
  });
});

describe('POST /api/post-event-reports — generate', () => {
  it('TC-03 Main 4-5: generates and stores a four-section report with the event defaults', async () => {
    const res = await generate(kelaniBody());

    expect(res.status).toBe(201);
    const { report } = res.body.data;
    expect(report).toEqual(
      expect.objectContaining({
        event: {
          id: String(event._id),
          name: 'Kelani basin floods',
          hazardType: 'FLOOD',
          startDate: '2026-06-08T00:00:00.000Z',
          endDate: '2026-06-20T00:00:00.000Z',
        },
        generatedBy: { id: officer.id, name: 'Ruwan Jayasinghe' },
        dateFrom: '2026-06-08',
        dateTo: '2026-06-20',
        districts: [
          { id: String(areas.colombo._id), name: 'Colombo' },
          { id: String(areas.gampaha._id), name: 'Gampaha' },
          { id: String(areas.kalutara._id), name: 'Kalutara' },
        ],
        filters: { hazardType: null, districtId: null, organisationId: null },
      }),
    );
    expect(report.sections.map((section) => section.key)).toEqual(ALL);
    expect(report.summary).toEqual({
      alertsIssued: 1,
      citizensReached: 1,
      citizensTargeted: 2,
      reachedRate: 0.5,
      peakOccupancy: 420,
      peakOccupancyDate: '2026-06-12',
      itemsDistributed: 150,
    });
    expect(report.hasGaps).toBe(true);
    expect(report.gaps.map((gap) => gap.section)).toEqual(expect.arrayContaining(ALL));
    expect(Date.parse(report.generatedAt)).not.toBeNaN();
    expect(report.createdAt).toBeDefined();

    const stored = await PostEventReport.findById(report.id).lean();
    expect(stored.generatedBy.equals(officer._id)).toBe(true);
    expect(stored.summary.peakOccupancy).toBe(420);
  });

  it('DMS-153.6: lists the districts in the event’s order, whatever order they were sent in', async () => {
    const res = await generate(
      kelaniBody({ districtIds: [areas.kalutara, areas.colombo].map((d) => String(d._id)) }),
    );

    expect(res.body.data.report.districts.map((d) => d.name)).toEqual(['Colombo', 'Kalutara']);
  });

  it('DMS-153.6: compiles only the sections asked for, in report order', async () => {
    const res = await generate(kelaniBody({ sections: ['resourceDistribution', 'alertTimeline'] }));

    expect(res.status).toBe(201);
    expect(res.body.data.report.sections.map((section) => section.key)).toEqual([
      'alertTimeline',
      'resourceDistribution',
    ]);
    expect(res.body.data.report.summary).toEqual(
      expect.objectContaining({ alertsIssued: 1, itemsDistributed: 150, citizensReached: null }),
    );
  });

  it('DMS-153.6: an unknown event is 404, and nothing is stored', async () => {
    const res = await generate(kelaniBody({ eventId: String(new ObjectId()) }));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(await PostEventReport.countDocuments()).toBe(0);
  });

  it('DMS-153.6: a missing or malformed field is 400 on that field', async () => {
    const res = await generate({
      eventId: 'nope',
      from: '8 Jun',
      districtIds: ['x'],
      sections: ['weather'],
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(fieldsOf(res)).toEqual(['districtIds.0', 'eventId', 'from', 'sections.0', 'to'].sort());
  });

  it.each([
    ['districtIds', [], 'must select at least one district'],
    ['sections', [], 'must select at least one section'],
    ['from', '2026-02-30', 'must be a date as YYYY-MM-DD'],
  ])('DMS-153.6: %s set to %p is refused with "%s"', async (field, value, message) => {
    const res = await generate(kelaniBody({ [field]: value }));

    expect(res.status).toBe(400);
    expect(res.body.error.errors).toEqual([{ field, message }]);
  });

  it('DMS-153.6: a repeated district or section is refused', async () => {
    const id = String(areas.colombo._id);
    const res = await generate(
      kelaniBody({ districtIds: [id, id], sections: ['alertTimeline', 'alertTimeline'] }),
    );

    expect(res.status).toBe(400);
    expect(fieldsOf(res)).toEqual(['districtIds.1', 'sections.1']);
  });
});

describe('GET /api/post-event-reports/:id', () => {
  it('DMS-153.6: reopens a stored report exactly as it was generated', async () => {
    const generated = (await generate(kelaniBody())).body.data.report;
    const colleague = await createUser({ role: Role.DMC_OFFICER });

    const res = await get(`/api/post-event-reports/${generated.id}`, colleague);

    expect(res.status).toBe(200);
    expect(res.body.data.report).toEqual(generated);
  });

  it.each([String(new ObjectId()), 'not-an-id'])('DMS-153.6: %s is 404', async (id) => {
    const res = await get(`/api/post-event-reports/${id}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('TC-01 Main 1: a district officer cannot open one (403)', async () => {
    const generated = (await generate(kelaniBody())).body.data.report;

    const res = await get(
      `/api/post-event-reports/${generated.id}`,
      await createUser({ role: Role.DISTRICT_OFFICER }),
    );

    expect(res.status).toBe(403);
  });
});

describe('GET /api/post-event-reports?eventId=', () => {
  it('DMS-153.6: lists the event’s reports newest first, without their sections', async () => {
    const first = (await generate(kelaniBody({ sections: ['alertTimeline'] }))).body.data.report;
    const second = (await generate(kelaniBody({ to: '2026-06-12' }))).body.data.report;

    const res = await get(`/api/post-event-reports?eventId=${event._id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.reports.map((report) => report.id)).toEqual([second.id, first.id]);
    expect(res.body.data.reports[0]).toEqual({
      id: second.id,
      event: { id: String(event._id), name: 'Kelani basin floods' },
      generatedBy: { id: officer.id, name: 'Ruwan Jayasinghe' },
      generatedAt: second.generatedAt,
      dateFrom: '2026-06-08',
      dateTo: '2026-06-12',
      districts: second.districts,
      filters: { hazardType: null, districtId: null, organisationId: null },
      hasGaps: second.hasGaps,
    });
  });

  it('DMS-153.6: a well-formed id with no reports is an empty list', async () => {
    const res = await get(`/api/post-event-reports?eventId=${new ObjectId()}`);

    expect(res.status).toBe(200);
    expect(res.body.data.reports).toEqual([]);
  });

  it.each(['', '?eventId=abc'])('DMS-153.6: "%s" is 400 on eventId', async (query) => {
    const res = await get(`/api/post-event-reports${query}`);

    expect(res.status).toBe(400);
    expect(fieldsOf(res)).toEqual(['eventId']);
  });
});
