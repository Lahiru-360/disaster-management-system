import mongoose from 'mongoose';
import request from 'supertest';
import { app } from '../../src/core/App.js';
import { Role } from '../../src/enums/Role.js';
import { HazardAlert } from '../../src/models/HazardAlert.js';
import { HazardEvent } from '../../src/models/HazardEvent.js';
import { OccupancyRecord } from '../../src/models/OccupancyRecord.js';
import { PostEventReport } from '../../src/models/PostEventReport.js';
import { seedAreas } from '../helpers/areaFixtures.js';
import { bearerFor } from '../helpers/authHelper.js';
import { createUser } from '../helpers/userFactory.js';

// UC04 E2 - no data for the selection (DMS-160, contract §14.3): when every
// requested section is empty nothing is generated or stored, and the officer
// goes back to event selection. Some empty sections, or an empty district,
// are not E2: the report is generated with the missing days marked.
const { ObjectId } = mongoose.Types;
const ALL = ['alertTimeline', 'citizensReached', 'occupancyOverTime', 'resourceDistribution'];
const june = (day, time = '12:00') =>
  new Date(`2026-06-${String(day).padStart(2, '0')}T${time}:00.000+05:30`);

let areas;
let kelani;
let officer;

beforeEach(async () => {
  areas = await seedAreas();
  officer = await createUser({ role: Role.DMC_OFFICER });
  kelani = await HazardEvent.create({
    name: 'Kelani basin floods',
    hazardType: 'FLOOD',
    status: 'CLOSED',
    startDate: new Date('2026-06-08'),
    endDate: new Date('2026-06-20'),
    districts: [areas.colombo._id, areas.gampaha._id, areas.kalutara._id],
  });
});

const generate = (fields = {}) =>
  request(app)
    .post('/api/post-event-reports')
    .set('Authorization', bearerFor(officer))
    .send({
      eventId: String(kelani._id),
      from: '2026-06-08',
      to: '2026-06-12',
      districtIds: [areas.colombo, areas.gampaha, areas.kalutara].map((d) => String(d._id)),
      sections: ALL,
      ...fields,
    });

// Occupancy every day 8-12 Jun at one shelter in Colombo and one in Gampaha;
// none in Kalutara.
const SHELTERS = [new ObjectId(), new ObjectId()];
const seedOccupancy = () =>
  OccupancyRecord.create(
    [8, 9, 10, 11, 12].flatMap((day) =>
      [areas.colombo, areas.gampaha].map((district, i) => ({
        shelter: SHELTERS[i],
        district: district._id,
        occupants: 100 * (i + 1) + day,
        capacity: 500,
        recordedAt: june(day),
        recordedBy: officer._id,
      })),
    ),
  );

describe('POST /api/post-event-reports — E2 no data for the selection', () => {
  it('TC-41 E2: every section empty is 404 NO_DATA_FOR_SELECTION, and no report is stored', async () => {
    const res = await generate();

    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({
      code: 'NO_DATA_FOR_SELECTION',
      message: 'No data is available for this selection.',
    });
    expect(await PostEventReport.countDocuments()).toBe(0);
  });

  it('TC-41 E2: data outside the selection still leaves it empty', async () => {
    await seedOccupancy();

    const res = await generate({ districtIds: [String(areas.kalutara._id)] });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NO_DATA_FOR_SELECTION');
    expect(await PostEventReport.countDocuments()).toBe(0);
  });

  it('TC-42 E2: with only some sections empty the report is generated, their days marked as gaps', async () => {
    await seedOccupancy();

    const res = await generate();

    expect(res.status).toBe(201);
    const { report } = res.body.data;
    expect(report.hasGaps).toBe(true);
    expect(report.gaps).toEqual([
      {
        section: 'alertTimeline',
        from: '2026-06-08',
        to: '2026-06-12',
        reason: 'No alert records',
      },
      {
        section: 'citizensReached',
        from: '2026-06-08',
        to: '2026-06-12',
        reason: 'No delivery records',
      },
      {
        section: 'resourceDistribution',
        from: '2026-06-08',
        to: '2026-06-12',
        reason: 'No distribution records',
      },
    ]);
    // 12 Jun: Colombo 112 + Gampaha 212.
    expect(report.summary.peakOccupancy).toBe(324);
    expect(await PostEventReport.countDocuments()).toBe(1);
  });

  it('TC-42 E2: a requested section with data is enough, whatever the others hold', async () => {
    await HazardAlert.create({
      referenceNo: 'HA-0001',
      hazardType: 'FLOOD',
      severity: 'HIGH',
      status: 'BROADCAST',
      targets: [{ kind: 'District', area: areas.gampaha._id }],
      event: kelani._id,
      createdBy: officer._id,
      statusHistory: [{ status: 'BROADCAST', version: 1, at: june(10), by: officer._id }],
    });

    const res = await generate({ sections: ['alertTimeline'] });

    expect(res.status).toBe(201);
    expect(res.body.data.report.summary.alertsIssued).toBe(1);
  });

  it('TC-43 E2: a district with no records shows no data on its own days, not a section gap', async () => {
    await seedOccupancy();

    const res = await generate({ sections: ['occupancyOverTime'] });

    expect(res.status).toBe(201);
    const { report } = res.body.data;
    const series = Object.fromEntries(
      report.sections[0].result.districts.map((row) => [row.district.name, row.days]),
    );
    expect(series.Kalutara.every((day) => day.peak === null)).toBe(true);
    expect(series.Colombo.every((day) => day.peak !== null)).toBe(true);
    expect(series.Gampaha.every((day) => day.peak !== null)).toBe(true);
    expect(report.gaps).toEqual([]);
    expect(report.hasGaps).toBe(false);
  });
});
