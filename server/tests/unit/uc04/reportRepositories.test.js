import mongoose from 'mongoose';
import { ReportContext } from '../../../src/domain/analysis/ReportContext.js';
import { HazardEvent } from '../../../src/domain/events/HazardEvent.js';
import { EventStatus } from '../../../src/enums/EventStatus.js';
import { HazardAlert } from '../../../src/models/HazardAlert.js';
import { Notification } from '../../../src/models/Notification.js';
import { OccupancyRecord } from '../../../src/models/OccupancyRecord.js';
import { Organisation } from '../../../src/models/Organisation.js';
import { SupplyDistribution } from '../../../src/models/SupplyDistribution.js';
import { ReportNames } from '../../../src/services/reports/ReportNames.js';
import { DeliveryRecordRepository } from '../../../src/services/reports/repositories/DeliveryRecordRepository.js';
import { OccupancyRecordRepository } from '../../../src/services/reports/repositories/OccupancyRecordRepository.js';
import { ReportAlertRepository } from '../../../src/services/reports/repositories/ReportAlertRepository.js';
import { SupplyDistributionRepository } from '../../../src/services/reports/repositories/SupplyDistributionRepository.js';
import { AlertTimelineSection } from '../../../src/services/reports/sections/AlertTimelineSection.js';
import { CitizensReachedSection } from '../../../src/services/reports/sections/CitizensReachedSection.js';
import { OccupancyOverTimeSection } from '../../../src/services/reports/sections/OccupancyOverTimeSection.js';
import { ResourceDistributionSection } from '../../../src/services/reports/sections/ResourceDistributionSection.js';
import { seedAreas } from '../../helpers/areaFixtures.js';
import { at } from './reportFixtures.js';

const { ObjectId } = mongoose.Types;

const officer = new ObjectId();
const eventId = new ObjectId();
const otherEventId = new ObjectId();

let areas;

const contextFor = (districts, fields = {}) =>
  new ReportContext({
    event: new HazardEvent({
      eventId,
      status: EventStatus.CLOSED,
      startDate: '2026-06-08T00:00:00.000Z',
      endDate: '2026-06-20T00:00:00.000Z',
      districts: districts.map((district) => district._id),
    }),
    dateFrom: '2026-06-08',
    dateTo: '2026-06-20',
    districtIds: districts.map((district) => String(district._id)),
    ...fields,
  });

let referenceNo = 1000;
const alert = (fields = {}) => {
  referenceNo += 1;
  return HazardAlert.create({
    referenceNo: `HA-${referenceNo}`,
    hazardType: 'FLOOD',
    severity: 'HIGH',
    message: 'Flood Warning: HIGH.',
    status: 'BROADCAST',
    targets: [{ kind: 'District', area: areas.colombo._id }],
    event: eventId,
    createdBy: officer,
    statusHistory: [
      { status: 'DRAFT', version: 1, at: at(1), by: officer },
      { status: 'BROADCAST', version: 1, at: at(9), by: officer },
    ],
    ...fields,
  });
};

const refsOf = (alerts) => alerts.map((found) => found.referenceNo).sort();

beforeEach(async () => {
  areas = await seedAreas();
  referenceNo = 1000;
});

describe('ReportAlertRepository.findForReport', () => {
  it('DMS-153.3: returns an issued alert of the event, with named areas and its non-DRAFT history', async () => {
    const saved = await alert({
      targets: [
        { kind: 'RiverBasin', area: areas.kelani._id },
        { kind: 'District', area: areas.kalutara._id },
      ],
    });

    const found = await new ReportAlertRepository().findForReport(contextFor([areas.colombo]));

    expect(found).toEqual([
      {
        id: String(saved._id),
        referenceNo: saved.referenceNo,
        hazardType: 'FLOOD',
        severity: 'HIGH',
        areas: [
          { kind: 'RiverBasin', id: String(areas.kelani._id), name: 'Kelani' },
          { kind: 'District', id: String(areas.kalutara._id), name: 'Kalutara' },
        ],
        history: [{ status: 'BROADCAST', version: 1, at: at(9), severity: null, areas: null }],
      },
    ]);
  });

  it('DMS-153.3: a river basin covers every district it spans', async () => {
    await alert({ targets: [{ kind: 'RiverBasin', area: areas.kelani._id }] });

    const repository = new ReportAlertRepository();

    expect(await repository.findForReport(contextFor([areas.gampaha]))).toHaveLength(1);
    expect(await repository.findForReport(contextFor([areas.kalutara]))).toHaveLength(0);
  });

  it('DMS-153.3: includes an alert linked to no event, and leaves out one linked to another event', async () => {
    await alert({ referenceNo: 'HA-0001', event: null });
    await alert({ referenceNo: 'HA-0002', event: otherEventId });

    const found = await new ReportAlertRepository().findForReport(contextFor([areas.colombo]));

    expect(refsOf(found)).toEqual(['HA-0001']);
  });

  it('DMS-153.3: leaves out a DRAFT, and an alert outside the selected districts', async () => {
    await alert({
      referenceNo: 'HA-0001',
      status: 'DRAFT',
      statusHistory: [{ status: 'DRAFT', version: 1, at: at(9), by: officer }],
    });
    await alert({
      referenceNo: 'HA-0002',
      targets: [{ kind: 'District', area: areas.kalutara._id }],
    });

    const found = await new ReportAlertRepository().findForReport(
      contextFor([areas.colombo, areas.gampaha]),
    );

    expect(found).toEqual([]);
  });

  it('TC-05 Main 6: leaves out an alert whose every change falls outside the range', async () => {
    await alert({
      referenceNo: 'HA-0001',
      statusHistory: [{ status: 'BROADCAST', version: 1, at: at(5), by: officer }],
    });
    // 8 Jun 00:00 Sri Lanka time is the first moment in; 21 Jun 00:00 the first out.
    await alert({
      referenceNo: 'HA-0002',
      statusHistory: [{ status: 'BROADCAST', version: 1, at: at(8, '00:00'), by: officer }],
    });
    await alert({
      referenceNo: 'HA-0003',
      statusHistory: [{ status: 'BROADCAST', version: 1, at: at(21, '00:00'), by: officer }],
    });

    const found = await new ReportAlertRepository().findForReport(contextFor([areas.colombo]));

    expect(refsOf(found)).toEqual(['HA-0002']);
  });

  it('DMS-153.3: an alert whose only in-range change is a DRAFT is left out', async () => {
    await alert({
      statusHistory: [
        { status: 'DRAFT', version: 1, at: at(10), by: officer },
        { status: 'BROADCAST', version: 1, at: at(25), by: officer },
      ],
    });

    expect(await new ReportAlertRepository().findForReport(contextFor([areas.colombo]))).toEqual(
      [],
    );
  });

  it('DMS-153.3: reads severity and areas recorded on a history entry, naming areas it knows', async () => {
    const saved = await alert();
    // §14.7 requests these fields on §12.1's history; written raw until they exist.
    await HazardAlert.collection.updateOne(
      { _id: saved._id },
      {
        $set: {
          'statusHistory.1.severity': 'SEVERE',
          'statusHistory.1.targets': [
            { kind: 'District', area: areas.colombo._id },
            { kind: 'District', area: areas.gampaha._id },
          ],
        },
      },
    );

    const [found] = await new ReportAlertRepository().findForReport(contextFor([areas.colombo]));

    expect(found.history[0].severity).toBe('SEVERE');
    expect(found.history[0].areas).toEqual([
      { kind: 'District', id: String(areas.colombo._id), name: 'Colombo' },
      // Gampaha isn't in the alert's current scope, so its name isn't at hand.
      { kind: 'District', id: String(areas.gampaha._id), name: null },
    ]);
  });

  it('DMS-153.3: skips a target whose area no longer exists', async () => {
    await alert({
      targets: [
        { kind: 'District', area: new ObjectId() },
        { kind: 'District', area: areas.colombo._id },
      ],
    });

    const [found] = await new ReportAlertRepository().findForReport(contextFor([areas.colombo]));

    expect(found.areas.map((area) => area.name)).toEqual(['Colombo']);
  });
});

describe('DeliveryRecordRepository.findSent', () => {
  const alertA = new ObjectId();
  const alertB = new ObjectId();
  const insert = (records) =>
    Notification.create(
      records.map(([alertId, status, sentAt, channel = 'SMS']) => ({
        alert: alertId,
        alertVersion: 1,
        kind: 'WARNING',
        citizen: new ObjectId(),
        channel,
        status,
        sentAt,
      })),
    );

  it("DMS-153.3: returns the alerts' records that left the queue inside the range", async () => {
    await insert([
      [alertA, 'DELIVERED', at(9), 'PUSH'],
      [alertA, 'FAILED', at(10)],
      [alertB, 'SENT', at(11)],
      [alertA, 'QUEUED', null],
      [alertA, 'DELIVERED', at(21)],
      [new ObjectId(), 'DELIVERED', at(9)],
    ]);
    const { start, end } = contextFor([areas.colombo]).instants();

    const found = await new DeliveryRecordRepository().findSent({
      alertIds: [String(alertA), String(alertB)],
      start,
      end,
    });

    expect(found.map((record) => [record.alert, record.status]).sort()).toEqual(
      [
        [String(alertA), 'DELIVERED'],
        [String(alertA), 'FAILED'],
        [String(alertB), 'SENT'],
      ].sort(),
    );
    expect(Object.keys(found[0]).sort()).toEqual([
      'alert',
      'channel',
      'citizen',
      'sentAt',
      'status',
    ]);
    expect(typeof found[0].citizen).toBe('string');
  });

  it('DMS-153.3: asks nothing of the database for no alerts', async () => {
    const { start, end } = contextFor([areas.colombo]).instants();
    expect(await new DeliveryRecordRepository().findSent({ alertIds: [], start, end })).toEqual([]);
  });
});

describe('OccupancyRecordRepository', () => {
  const s1 = new ObjectId();
  const s2 = new ObjectId();
  const s3 = new ObjectId();
  const insert = (records) =>
    OccupancyRecord.create(
      records.map(([shelter, district, occupants, recordedAt]) => ({
        shelter,
        district: district._id,
        occupants,
        capacity: 500,
        recordedAt,
        recordedBy: officer,
      })),
    );

  it('DMS-153.3: findInRange returns the districts’ records inside the range, oldest first', async () => {
    await insert([
      [s1, areas.gampaha, 300, at(12)],
      [s1, areas.gampaha, 200, at(9)],
      [s2, areas.colombo, 100, at(10)],
      [s3, areas.kalutara, 999, at(10)],
      [s1, areas.gampaha, 50, at(7)],
    ]);
    const { start, end } = contextFor([areas.gampaha]).instants();

    const found = await new OccupancyRecordRepository().findInRange({
      districtIds: [String(areas.gampaha._id), String(areas.colombo._id)],
      start,
      end,
    });

    expect(found.map((record) => record.occupants)).toEqual([200, 100, 300]);
    expect(found[0]).toEqual({
      shelter: String(s1),
      district: String(areas.gampaha._id),
      occupants: 200,
      recordedAt: at(9),
    });
  });

  it('DMS-153.3: findLatestBefore returns each shelter’s last record before the range', async () => {
    await insert([
      [s1, areas.gampaha, 50, at(5)],
      [s1, areas.gampaha, 80, at(7)],
      [s2, areas.gampaha, 30, at(6)],
      [s1, areas.gampaha, 300, at(9)],
      [s3, areas.kalutara, 999, at(6)],
    ]);
    const { start } = contextFor([areas.gampaha]).instants();

    const found = await new OccupancyRecordRepository().findLatestBefore({
      districtIds: [String(areas.gampaha._id)],
      start,
    });

    expect(found.map((record) => [record.shelter, record.occupants]).sort()).toEqual(
      [
        [String(s1), 80],
        [String(s2), 30],
      ].sort(),
    );
  });
});

describe('SupplyDistributionRepository', () => {
  it('DMS-153.3: returns the districts’ distributions logged inside the range', async () => {
    const organisation = new ObjectId();
    await SupplyDistribution.create(
      [
        [areas.gampaha, 500, at(10)],
        [areas.gampaha, 70, at(21)],
        [areas.kalutara, 40, at(10)],
      ].map(([district, quantity, distributedAt]) => ({
        shelter: new ObjectId(),
        stock: new ObjectId(),
        organisation,
        supplyType: 'WATER',
        district: district._id,
        quantity,
        distributedAt,
        loggedBy: officer,
      })),
    );
    const { start, end } = contextFor([areas.gampaha]).instants();

    const found = await new SupplyDistributionRepository().findInRange({
      districtIds: [String(areas.gampaha._id)],
      start,
      end,
    });

    expect(found).toEqual([
      {
        district: String(areas.gampaha._id),
        supplyType: 'WATER',
        organisation: String(organisation),
        quantity: 500,
        distributedAt: at(10),
      },
    ]);
  });
});

describe('ReportNames', () => {
  it('DMS-153.3: names districts by id, in the order asked, with null for an unknown id', async () => {
    const unknown = String(new ObjectId());

    const names = await new ReportNames().districts([
      String(areas.gampaha._id),
      unknown,
      String(areas.colombo._id),
    ]);

    expect([...names.values()]).toEqual([
      { id: String(areas.gampaha._id), name: 'Gampaha' },
      { id: unknown, name: null },
      { id: String(areas.colombo._id), name: 'Colombo' },
    ]);
  });

  it('DMS-153.3: names organisations with their type', async () => {
    const redCross = await Organisation.create({ name: 'Red Cross Sri Lanka', type: 'NGO' });
    const unknown = String(new ObjectId());

    const names = await new ReportNames().organisations([String(redCross._id), unknown]);

    expect(names.get(String(redCross._id))).toEqual({
      id: String(redCross._id),
      name: 'Red Cross Sri Lanka',
      type: 'NGO',
    });
    expect(names.get(unknown)).toEqual({ id: unknown, name: null, type: null });
  });

  it('DMS-153.3: asks nothing of the database for no ids', async () => {
    expect((await new ReportNames().districts([])).size).toBe(0);
  });
});

describe('the four sections with their default repositories', () => {
  it('DMS-153.3: compile against the database without anything injected', async () => {
    const saved = await alert();
    const organisation = await Organisation.create({ name: 'UNICEF Sri Lanka', type: 'DONOR' });
    const shelter = new ObjectId();
    await Notification.create({
      alert: saved._id,
      alertVersion: 1,
      kind: 'WARNING',
      citizen: new ObjectId(),
      channel: 'SMS',
      status: 'DELIVERED',
      sentAt: at(9),
    });
    await OccupancyRecord.create(
      [
        [120, at(7)],
        [180, at(9)],
      ].map(([occupants, recordedAt]) => ({
        shelter,
        district: areas.colombo._id,
        occupants,
        capacity: 500,
        recordedAt,
        recordedBy: officer,
      })),
    );
    await SupplyDistribution.create({
      shelter: new ObjectId(),
      stock: new ObjectId(),
      loggedBy: officer,
      district: areas.colombo._id,
      supplyType: 'FOOD',
      organisation: organisation._id,
      quantity: 25,
      distributedAt: at(9),
    });
    const ctx = contextFor([areas.colombo], { dateFrom: '2026-06-09', dateTo: '2026-06-09' });

    const [timeline, reached, occupancy, distribution] = await Promise.all(
      [
        new AlertTimelineSection(),
        new CitizensReachedSection(),
        new OccupancyOverTimeSection(),
        new ResourceDistributionSection(),
      ].map((section) => section.compile(ctx)),
    );

    expect(timeline.result.entries.map((entry) => entry.alert.referenceNo)).toEqual([
      saved.referenceNo,
    ]);
    expect(reached.result.citizensReached).toBe(1);
    expect(occupancy.result.districts[0]).toEqual({
      district: { id: String(areas.colombo._id), name: 'Colombo' },
      days: [{ date: '2026-06-09', peak: 180 }],
      peak: { value: 180, date: '2026-06-09' },
    });
    expect(distribution.result.rows).toEqual([
      {
        district: { id: String(areas.colombo._id), name: 'Colombo' },
        supplyType: 'FOOD',
        organisation: { id: String(organisation._id), name: 'UNICEF Sri Lanka', type: 'DONOR' },
        quantity: 25,
      },
    ]);
    expect(
      [timeline, reached, occupancy, distribution].every(
        ({ isEmpty, gaps }) => !isEmpty && gaps.length === 0,
      ),
    ).toBe(true);
  });
});
