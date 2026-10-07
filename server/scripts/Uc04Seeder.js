import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { MessageTemplate } from '../src/domain/alerts/MessageTemplate.js';
import { AlertHazardType } from '../src/enums/AlertHazardType.js';
import { AlertStatus } from '../src/enums/AlertStatus.js';
import { Channel } from '../src/enums/Channel.js';
import { DeliveryStatus } from '../src/enums/DeliveryStatus.js';
import { NotificationKind } from '../src/enums/NotificationKind.js';
import { Role } from '../src/enums/Role.js';
import { SeverityLevel } from '../src/enums/SeverityLevel.js';
import { SupplyType } from '../src/enums/SupplyType.js';
import { District } from '../src/models/District.js';
import { HazardAlert } from '../src/models/HazardAlert.js';
import { HazardEvent } from '../src/models/HazardEvent.js';
import { Notification } from '../src/models/Notification.js';
import { OccupancyRecord } from '../src/models/OccupancyRecord.js';
import { Organisation } from '../src/models/Organisation.js';
import { PostEventReport } from '../src/models/PostEventReport.js';
import { ReliefStock } from '../src/models/ReliefStock.js';
import { RiverBasin } from '../src/models/RiverBasin.js';
import { Shelter } from '../src/models/Shelter.js';
import { SupplyDistribution } from '../src/models/SupplyDistribution.js';
import { User } from '../src/models/User.js';
import { ReferenceNumberGenerator } from '../src/services/ReferenceNumberGenerator.js';
import { Seeder } from './Seeder.js';

// UC04 demo data: the history of the CLOSED "Kelani basin floods" event (8-20
// Jun 2026, Colombo, Gampaha and Kalutara) that the post-event report is
// generated from. Every day of the event has alerts, deliveries and relief
// distributions; shelter occupancy has a deliberate 14-15 Jun gap (officers
// offline), so the report shows its incomplete-data banner. The day the
// shelters peak (12 Jun) totals the wireframe's 4,120 people.
//
// Safe to re-run: every record is matched by its natural key and only
// inserted when missing. Generated reports are the demo data `--reset-demo`
// empties; the history is reference data, like the event itself. Expects an
// open connection and the districts, people, organisations, hazard events and
// UC03 data already seeded - DatabaseSeeder owns both.
export class Uc04Seeder extends Seeder {
  static #EVENT = 'Kelani basin floods';

  static #OFFICER_EMAIL = 'dmc.officer@example.test';

  static #DISTRICT_OFFICER_EMAIL = 'district.officer@example.test';

  static #RECIPIENT_ROLES = [Role.CITIZEN, Role.COMMUNITY_VOLUNTEER];

  // Seeded alerts take HA-0001 onwards; the live counter continues after them.
  static HIGHEST_ALERT_NUMBER = 14;

  // Each alert is issued, maybe updated, then cleared, at Sri Lanka times in
  // June. An all-clear is its own version, like an update. Together they put
  // at least one status change on every day of the event.
  static #ALERTS = [
    ['HA-0001', 'FLOOD', 'SEVERE', ['RiverBasin:Kelani'], '08 06:30', ['10 09:00'], '18 17:00'],
    ['HA-0002', 'FLOOD', 'MEDIUM', ['District:Kalutara'], '08 14:00', [], '12 10:00'],
    ['HA-0003', 'FLOOD', 'HIGH', ['District:Colombo'], '09 07:15', ['11 08:00'], '17 12:00'],
    ['HA-0004', 'LANDSLIDE', 'HIGH', ['District:Kalutara'], '09 16:40', [], '13 09:30'],
    ['HA-0005', 'FLOOD', 'SEVERE', ['District:Gampaha'], '10 05:50', [], '19 08:00'],
    ['HA-0006', 'FLOOD', 'MEDIUM', ['District:Colombo'], '11 13:20', [], '14 11:00'],
    ['HA-0007', 'FLOOD', 'HIGH', ['District:Gampaha'], '12 06:10', ['13 15:00'], '16 10:30'],
    ['HA-0008', 'LANDSLIDE', 'MEDIUM', ['District:Kalutara'], '13 18:00', [], '15 09:00'],
    ['HA-0009', 'FLOOD', 'HIGH', ['RiverBasin:Kelani'], '14 07:00', [], '20 10:00'],
    ['HA-0010', 'FLOOD', 'HIGH', ['District:Kalutara'], '15 06:45', [], '19 14:00'],
    ['HA-0011', 'FLOOD', 'LOW', ['District:Colombo'], '16 09:00', [], '18 09:00'],
    ['HA-0012', 'FLOOD', 'MEDIUM', ['District:Gampaha'], '17 08:30', [], '20 12:00'],
    ['HA-0013', 'FLOOD', 'LOW', ['District:Kalutara'], '18 10:00', [], '20 15:00'],
    ['HA-0014', 'FLOOD', 'MEDIUM', ['District:Colombo'], '19 07:30', [], '20 16:00'],
  ].map(([referenceNo, hazardType, severity, targets, issued, updates, allClear]) => ({
    referenceNo,
    hazardType: AlertHazardType[hazardType],
    severity: SeverityLevel[severity],
    targets: targets.map((target) => target.split(':')),
    issued,
    updates,
    allClear,
  }));

  // Gampaha reuses UC03's five shelters, untouched, so UC03's dashboard still
  // shows the hi-fi's five; Colombo and Kalutara get Kelani shelters, emptied
  // now the event is over. `peak` is each shelter's count at 14:00 on 12 Jun:
  // they total 4,120.
  static #SHELTERS = {
    Colombo: [
      { name: 'Kolonnawa Maha Vidyalaya', capacity: 800, peak: 760, at: [6.9283, 79.8853] },
      { name: 'Wellampitiya Community Hall', capacity: 600, peak: 560, at: [6.9388, 79.8935] },
      { name: 'Kaduwela Central College', capacity: 500, peak: 470, at: [6.9306, 79.9839] },
    ],
    Gampaha: [
      { name: 'Gampaha Central College', capacity: 500, peak: 480 },
      { name: 'Minuwangoda National School', capacity: 400, peak: 390 },
      { name: 'Attanagalla Vidyalaya', capacity: 300, peak: 290 },
      { name: 'Ja-Ela Central College', capacity: 350, peak: 330 },
      { name: 'Divulapitiya School', capacity: 250, peak: 240 },
    ],
    Kalutara: [
      { name: 'Kalutara Maha Vidyalaya', capacity: 400, peak: 350, at: [6.5854, 79.9607] },
      { name: 'Panadura Sri Sumangala College', capacity: 300, peak: 250, at: [6.7132, 79.9026] },
    ],
  };

  // How full the shelters were each day, as a share of their peak. 14 and 15
  // Jun are missing on purpose: no occupancy was recorded while offline.
  static #OCCUPANCY_LEVELS = [
    ['08', 0.25],
    ['09', 0.45],
    ['10', 0.7],
    ['11', 0.85],
    ['12', 1],
    ['13', 0.9],
    ['16', 0.6],
    ['17', 0.45],
    ['18', 0.3],
    ['19', 0.15],
    ['20', 0.05],
  ];

  // Three updates a day; the afternoon one is the day's highest.
  static #OCCUPANCY_UPDATES = [
    ['08:00', 0.9],
    ['14:00', 1],
    ['20:00', 0.95],
  ];

  // One distribution a day per organisation and district: daily base x
  // district weight x day level, so 29 x 14 x 46 = 18,676 items in all.
  static #SUPPLIES = [
    {
      organisation: 'Red Cross Sri Lanka',
      supplyType: SupplyType.WATER,
      unit: 'bottles',
      base: 15,
    },
    { organisation: 'Government/DMC', supplyType: SupplyType.FOOD, unit: 'packs', base: 9 },
    { organisation: 'ADRA', supplyType: SupplyType.BLANKETS, unit: 'units', base: 3 },
    {
      organisation: 'UNICEF Sri Lanka',
      supplyType: SupplyType.HYGIENE_KITS,
      unit: 'units',
      base: 2,
    },
  ];

  static #DISTRICT_WEIGHTS = { Colombo: 6, Gampaha: 5, Kalutara: 3 };

  static #DISTRIBUTION_LEVELS = [2, 3, 4, 5, 5, 5, 4, 4, 4, 3, 3, 2, 2];

  #referenceNumbers;

  constructor({
    referenceNumbers = new ReferenceNumberGenerator({ counterName: 'hazardAlert', prefix: 'HA' }),
  } = {}) {
    super();
    this.#referenceNumbers = referenceNumbers;
  }

  get demoModels() {
    return [PostEventReport];
  }

  async run() {
    const event = await Uc04Seeder.#event();
    const officer = await Uc04Seeder.#user(Uc04Seeder.#OFFICER_EMAIL);
    const districtOfficer = await Uc04Seeder.#user(Uc04Seeder.#DISTRICT_OFFICER_EMAIL);
    const districts = await Uc04Seeder.#districtIdsByName(Object.keys(Uc04Seeder.#SHELTERS));

    const deliveries = await this.#seedAlerts(event, officer);
    await this.#referenceNumbers.reserveUpTo(Uc04Seeder.HIGHEST_ALERT_NUMBER);
    const shelters = await Uc04Seeder.#seedShelters(districts);
    const occupancy = await Uc04Seeder.#seedOccupancy(shelters, districtOfficer);
    const distributions = await Uc04Seeder.#seedDistributions(districts, shelters, districtOfficer);

    console.log(
      `Seeded UC04: ${Uc04Seeder.#ALERTS.length} Kelani alerts, ${deliveries} delivery records, ` +
        `${occupancy} occupancy records, ${distributions} supply distributions`,
    );
  }

  // --- Alerts and their delivery records (UC01 data) ---

  async #seedAlerts(event, officer) {
    const order = await Uc04Seeder.#citizenOrder();
    let deliveries = 0;
    for (const spec of Uc04Seeder.#ALERTS) {
      const targets = await Uc04Seeder.#targets(spec.targets);
      const sends = Uc04Seeder.#sends(spec);
      const last = sends[sends.length - 1];

      const existing = await HazardAlert.findOne({ referenceNo: spec.referenceNo });
      if (existing && String(existing.event) !== String(event._id)) {
        throw new Error(
          `${spec.referenceNo} is already a live alert - run "npm run seed -- --reset-demo" ` +
            'so the Kelani alerts can take HA-0001 to HA-0014',
        );
      }

      const alert = await HazardAlert.findOneAndUpdate(
        { referenceNo: spec.referenceNo },
        {
          $set: {
            hazardType: spec.hazardType,
            severity: spec.severity,
            message: MessageTemplate.generate(spec.hazardType, spec.severity),
            status: AlertStatus.CANCELLED,
            version: last.version,
            targets: targets.map(({ kind, area }) => ({ kind, area: area._id })),
            event: event._id,
            createdBy: officer,
            issuedBy: officer,
            issuedAt: sends[0].at,
            statusHistory: [
              {
                status: AlertStatus.DRAFT,
                version: 1,
                at: new Date(sends[0].at.getTime() - 10 * 60 * 1000),
                by: officer,
              },
              ...sends.map(({ status, version, at }) => ({ status, version, at, by: officer })),
            ],
          },
          $setOnInsert: { _id: Uc04Seeder.#idFor('alert', spec.referenceNo) },
        },
        { upsert: true, runValidators: true, returnDocument: 'after' },
      );

      const recipients = await Uc04Seeder.#recipients(targets);
      deliveries += await Uc04Seeder.#seedDeliveries(alert, sends, recipients, order);
    }
    return deliveries;
  }

  // The issue, each update and the all-clear, each a version of its own.
  static #sends({ issued, updates, allClear }) {
    return [
      { status: AlertStatus.BROADCAST, kind: NotificationKind.WARNING, at: issued },
      ...updates.map((at) => ({ status: AlertStatus.UPDATED, kind: NotificationKind.UPDATE, at })),
      { status: AlertStatus.CANCELLED, kind: NotificationKind.ALL_CLEAR, at: allClear },
    ].map((send, index) => ({ ...send, version: index + 1, at: Uc04Seeder.#june(send.at) }));
  }

  // One record per recipient, channel and version. Outcomes are fixed by the
  // citizen's place in the email order, so a re-seed gives the same report:
  // about 6% of citizens are never reached by any alert (every channel
  // FAILED), and the rest are usually reached on more than one channel, but
  // counted once.
  static async #seedDeliveries(alert, sends, recipients, order) {
    const operations = sends.flatMap((send, sendIndex) =>
      recipients.flatMap((citizen) =>
        Object.values(Channel).map((channel) => {
          const citizenIndex = order.get(String(citizen));
          const status = Uc04Seeder.#outcome(citizenIndex, sendIndex, channel);
          const sentAt = new Date(send.at.getTime() + (citizenIndex % 5) * 60 * 1000);
          return {
            updateOne: {
              filter: { alert: alert._id, alertVersion: send.version, citizen, channel },
              update: {
                $setOnInsert: {
                  kind: send.kind,
                  status,
                  attempts: 1,
                  sentAt,
                  deliveredAt:
                    status === DeliveryStatus.DELIVERED
                      ? new Date(sentAt.getTime() + 60 * 1000)
                      : null,
                  failureReason: status === DeliveryStatus.FAILED ? 'Device unreachable' : null,
                },
              },
              upsert: true,
            },
          };
        }),
      ),
    );
    if (operations.length > 0) {
      await Notification.bulkWrite(operations, { ordered: false });
    }
    return operations.length;
  }

  static #outcome(citizenIndex, sendIndex, channel) {
    const turn = citizenIndex + sendIndex;
    if (citizenIndex % 17 === 0) return DeliveryStatus.FAILED;
    if (channel === Channel.PUSH && turn % 9 === 0) return DeliveryStatus.FAILED;
    if (channel === Channel.SMS && turn % 23 === 0) return DeliveryStatus.FAILED;
    if (channel === Channel.AUDIBLE && turn % 11 === 0) return DeliveryStatus.SENT;
    return DeliveryStatus.DELIVERED;
  }

  // Citizens and volunteers living in the districts the targets cover. A river
  // basin covers every district it spans.
  static async #recipients(targets) {
    const districtIds = targets.flatMap(({ kind, area }) =>
      kind === 'RiverBasin' ? area.districts : [area._id],
    );
    const people = await User.find(
      { role: { $in: Uc04Seeder.#RECIPIENT_ROLES }, homeDistrict: { $in: districtIds } },
      '_id',
    ).sort({ email: 1 });
    return people.map((person) => person._id);
  }

  // Every possible recipient's place when sorted by email: the same on every
  // machine, unlike their ids.
  static async #citizenOrder() {
    const people = await User.find({ role: { $in: Uc04Seeder.#RECIPIENT_ROLES } }, '_id').sort({
      email: 1,
    });
    return new Map(people.map((person, index) => [String(person._id), index]));
  }

  static async #targets(targets) {
    return Promise.all(
      targets.map(async ([kind, name]) => {
        const model = kind === 'RiverBasin' ? RiverBasin : District;
        const area = await model.findOne({ name });
        if (!area) {
          throw new Error(`${kind} "${name}" is not seeded - run DistrictSeeder first`);
        }
        return { kind, area };
      }),
    );
  }

  // --- Shelters, occupancy and relief distributions (UC03 data) ---

  static async #seedShelters(districts) {
    const shelters = {};
    for (const [districtName, specs] of Object.entries(Uc04Seeder.#SHELTERS)) {
      const district = districts.get(districtName);
      shelters[districtName] = [];
      for (const spec of specs) {
        const shelter = spec.at
          ? await Shelter.findOneAndUpdate(
              { district, name: spec.name },
              {
                $set: {
                  capacity: spec.capacity,
                  location: { lat: spec.at[0], lng: spec.at[1], label: spec.name },
                },
                $setOnInsert: {
                  _id: Uc04Seeder.#idFor('shelter', districtName, spec.name),
                  currentOccupancy: 0,
                },
              },
              { upsert: true, runValidators: true, returnDocument: 'after' },
            )
          : await Shelter.findOne({ district, name: spec.name });
        if (!shelter) {
          throw new Error(`Shelter "${spec.name}" is not seeded - run Uc03Seeder first`);
        }
        shelters[districtName].push({ ...spec, id: shelter._id, district });
      }
    }
    return shelters;
  }

  static async #seedOccupancy(shelters, recordedBy) {
    const operations = Object.values(shelters)
      .flat()
      .flatMap((shelter) =>
        Uc04Seeder.#OCCUPANCY_LEVELS.flatMap(([day, level]) =>
          Uc04Seeder.#OCCUPANCY_UPDATES.map(([time, share]) => {
            const recordedAt = Uc04Seeder.#june(`${day} ${time}`);
            return {
              updateOne: {
                filter: { shelter: shelter.id, recordedAt },
                update: {
                  $setOnInsert: {
                    _id: Uc04Seeder.#idFor(
                      'occupancy',
                      String(shelter.id),
                      recordedAt.toISOString(),
                    ),
                    district: shelter.district,
                    occupants: Math.round(shelter.peak * level * share),
                    capacity: shelter.capacity,
                    recordedBy,
                  },
                },
                upsert: true,
              },
            };
          }),
        ),
      );
    await OccupancyRecord.bulkWrite(operations, { ordered: false });
    return operations.length;
  }

  static async #seedDistributions(districts, shelters, loggedBy) {
    const organisations = await Uc04Seeder.#organisationIdsByName();
    const operations = [];

    for (const [districtName, weight] of Object.entries(Uc04Seeder.#DISTRICT_WEIGHTS)) {
      const district = districts.get(districtName);
      for (const [supplyIndex, supply] of Uc04Seeder.#SUPPLIES.entries()) {
        const organisation = organisations.get(supply.organisation);
        const stock = await Uc04Seeder.#stock(districtName, district, organisation, supply);

        Uc04Seeder.#DISTRIBUTION_LEVELS.forEach((level, dayIndex) => {
          const day = String(8 + dayIndex).padStart(2, '0');
          const distributedAt = Uc04Seeder.#june(`${day} ${10 + supplyIndex}:15`);
          const districtShelters = shelters[districtName];
          const shelter = districtShelters[(dayIndex + supplyIndex) % districtShelters.length];
          operations.push({
            updateOne: {
              filter: { shelter: shelter.id, stock, distributedAt },
              update: {
                $setOnInsert: {
                  _id: Uc04Seeder.#idFor(
                    'distribution',
                    String(stock),
                    distributedAt.toISOString(),
                  ),
                  organisation,
                  supplyType: supply.supplyType,
                  district,
                  quantity: supply.base * weight * level,
                  loggedBy,
                },
              },
              upsert: true,
            },
          });
        });
      }
    }
    await SupplyDistribution.bulkWrite(operations, { ordered: false });
    return operations.length;
  }

  // Gampaha draws on UC03's stock rows as they are; Colombo and Kalutara get
  // Kelani rows, all given out by now.
  static async #stock(districtName, district, organisation, supply) {
    const key = { organisation, district, supplyType: supply.supplyType };
    if (districtName === 'Gampaha') {
      const row = await ReliefStock.findOne(key);
      if (!row) {
        throw new Error(
          `${supply.organisation} ${supply.supplyType} stock in Gampaha is not seeded - run Uc03Seeder first`,
        );
      }
      return row._id;
    }
    const row = await ReliefStock.findOneAndUpdate(
      key,
      {
        $set: { unit: supply.unit },
        $setOnInsert: {
          _id: Uc04Seeder.#idFor('stock', districtName, supply.organisation, supply.supplyType),
          quantityAvailable: 0,
        },
      },
      { upsert: true, runValidators: true, returnDocument: 'after' },
    );
    return row._id;
  }

  // --- Prerequisites and helpers ---

  // "14 07:00" -> that time on 14 Jun 2026 in Sri Lanka.
  static #june(dayAndTime) {
    const [day, time] = dayAndTime.split(' ');
    return new Date(`2026-06-${day}T${time.padStart(5, '0')}:00.000+05:30`);
  }

  // A record's id comes from its natural key, so --reset-demo recreates the
  // same ids. Only used on insert.
  static #idFor(...key) {
    const hex = createHash('sha1')
      .update(['uc04', ...key].join('|'))
      .digest('hex')
      .slice(0, 24);
    return new mongoose.Types.ObjectId(hex);
  }

  static async #event() {
    const event = await HazardEvent.findOne({ name: Uc04Seeder.#EVENT });
    if (!event) {
      throw new Error(
        `Hazard event "${Uc04Seeder.#EVENT}" is not seeded - run HazardEventSeeder first`,
      );
    }
    return event;
  }

  static async #user(email) {
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error(`Demo account ${email} is not seeded - run PeopleSeeder first`);
    }
    return user._id;
  }

  static async #districtIdsByName(names) {
    const found = await District.find({ name: { $in: names } });
    const idsByName = new Map(found.map((district) => [district.name, district._id]));
    for (const name of names) {
      if (!idsByName.has(name)) {
        throw new Error(`District "${name}" is not seeded - run DistrictSeeder first`);
      }
    }
    return idsByName;
  }

  static async #organisationIdsByName() {
    const names = Uc04Seeder.#SUPPLIES.map((supply) => supply.organisation);
    const found = await Organisation.find({ name: { $in: names } });
    const idsByName = new Map(found.map((organisation) => [organisation.name, organisation._id]));
    for (const name of names) {
      if (!idsByName.has(name)) {
        throw new Error(`Organisation "${name}" is not seeded - run OrganisationSeeder first`);
      }
    }
    return idsByName;
  }
}
