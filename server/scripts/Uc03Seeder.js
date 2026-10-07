import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { SupplyType } from '../src/enums/SupplyType.js';
import { TeamStatus } from '../src/enums/TeamStatus.js';
import { District } from '../src/models/District.js';
import { OccupancyRecord } from '../src/models/OccupancyRecord.js';
import { Organisation } from '../src/models/Organisation.js';
import { ReliefStock } from '../src/models/ReliefStock.js';
import { RescueTeam } from '../src/models/RescueTeam.js';
import { Shelter } from '../src/models/Shelter.js';
import { SupplyDistribution } from '../src/models/SupplyDistribution.js';
import { User } from '../src/models/User.js';
import { Seeder } from './Seeder.js';

// UC03 demo data for the active Gampaha flood, taken from the coordination
// dashboard hi-fi the improved design keeps: its five shelters, teams Alpha to
// Echo, organisation-owned relief stock and the recent supply logs. Safe to
// re-run: records are matched by their natural key. What describes a record
// (name, place, capacity, owner) is set again; what the demo changes
// (occupancy, team status and location, stock left) is only set when the
// record is first created, so a re-seed never undoes an officer's work -
// `--reset-demo` is how to start over. Expects an open connection and the
// districts, organisations and demo accounts already seeded.
export class Uc03Seeder extends Seeder {
  static #DISTRICT = 'Gampaha';

  static #LEAD_EMAIL = 'rescue.lead@example.test';

  static #OFFICER_EMAIL = 'district.officer@example.test';

  // Occupancies give the hi-fi's 92%, 76%, 45%, 60% and 30%.
  static #SHELTERS = [
    {
      name: 'Gampaha Central College',
      location: { lat: 7.0917, lng: 79.9999, label: 'Gampaha town' },
      capacity: 500,
      currentOccupancy: 460,
    },
    {
      name: 'Minuwangoda National School',
      location: { lat: 7.1663, lng: 79.9511, label: 'Minuwangoda' },
      capacity: 400,
      currentOccupancy: 304,
    },
    {
      name: 'Attanagalla Vidyalaya',
      location: { lat: 7.1081, lng: 80.1333, label: 'Attanagalla' },
      capacity: 300,
      currentOccupancy: 135,
    },
    {
      name: 'Ja-Ela Central College',
      location: { lat: 7.0744, lng: 79.8919, label: 'Ja-Ela' },
      capacity: 350,
      currentOccupancy: 210,
    },
    {
      name: 'Divulapitiya School',
      location: { lat: 7.2228, lng: 80.0128, label: 'Divulapitiya' },
      capacity: 250,
      currentOccupancy: 75,
    },
  ];

  // Alpha and Echo's owners come from the Dispatch Rescue Team wireframe.
  // Every team starts AVAILABLE: a busy team needs a dispatch behind it.
  static #TEAMS = [
    {
      name: 'Team Alpha',
      organisation: 'SL Army',
      memberCount: 8,
      base: { lat: 7.0897, lng: 79.9925, label: 'Gampaha HQ' },
      ledByDemoLead: true,
    },
    {
      name: 'Team Bravo',
      organisation: 'Sri Lanka Police',
      memberCount: 6,
      base: { lat: 7.076, lng: 79.895, label: 'Ja-Ela' },
    },
    {
      name: 'Team Charlie',
      organisation: 'Government/DMC',
      memberCount: 7,
      base: { lat: 7.0283, lng: 79.9214, label: 'Ragama' },
    },
    {
      name: 'Team Delta',
      organisation: 'SL Army',
      memberCount: 8,
      base: { lat: 7.17, lng: 79.953, label: 'Minuwangoda' },
    },
    {
      name: 'Team Echo',
      organisation: 'Fire Service',
      memberCount: 6,
      base: { lat: 7.11, lng: 80.13, label: 'Attanagalla' },
    },
  ];

  // What each organisation still holds after the logs below. Red Cross water
  // is the Log Relief Supply wireframe's "Available stock 1,200 bottles".
  static #STOCK = [
    {
      organisation: 'Red Cross Sri Lanka',
      supplyType: SupplyType.WATER,
      unit: 'bottles',
      quantityAvailable: 1200,
    },
    {
      organisation: 'Government/DMC',
      supplyType: SupplyType.FOOD,
      unit: 'packs',
      quantityAvailable: 800,
    },
    {
      organisation: 'ADRA',
      supplyType: SupplyType.BLANKETS,
      unit: 'units',
      quantityAvailable: 400,
    },
    {
      organisation: 'SL Army',
      supplyType: SupplyType.MEDICINE,
      unit: 'units',
      quantityAvailable: 150,
    },
    {
      organisation: 'UNICEF Sri Lanka',
      supplyType: SupplyType.HYGIENE_KITS,
      unit: 'units',
      quantityAvailable: 350,
    },
  ];

  // The hi-fi's Recent Relief Supply Logs, moved into the current event
  // period (Sri Lanka time).
  static #DISTRIBUTIONS = [
    {
      organisation: 'Red Cross Sri Lanka',
      supplyType: SupplyType.WATER,
      shelter: 'Gampaha Central College',
      quantity: 500,
      at: '2026-10-03T14:30:00+05:30',
    },
    {
      organisation: 'Government/DMC',
      supplyType: SupplyType.FOOD,
      shelter: 'Minuwangoda National School',
      quantity: 200,
      at: '2026-10-03T13:15:00+05:30',
    },
    {
      organisation: 'ADRA',
      supplyType: SupplyType.BLANKETS,
      shelter: 'Ja-Ela Central College',
      quantity: 100,
      at: '2026-10-03T11:20:00+05:30',
    },
    {
      organisation: 'SL Army',
      supplyType: SupplyType.MEDICINE,
      shelter: 'Attanagalla Vidyalaya',
      quantity: 50,
      at: '2026-10-03T09:45:00+05:30',
    },
    {
      organisation: 'UNICEF Sri Lanka',
      supplyType: SupplyType.HYGIENE_KITS,
      shelter: 'Divulapitiya School',
      quantity: 150,
      at: '2026-10-03T08:10:00+05:30',
    },
  ];

  // The shelters filled up over the days before the dashboard's snapshot: each
  // share is the part of today's occupancy recorded at that evening's update
  // (Sri Lanka time), ending at today's figure. This is the history UC04's
  // "occupancy over time" reads, and the last record agrees with the shelter.
  static #OCCUPANCY_HISTORY = [
    { share: 0.2, at: '2026-09-29T18:00:00+05:30' },
    { share: 0.45, at: '2026-09-30T18:00:00+05:30' },
    { share: 0.7, at: '2026-10-01T18:00:00+05:30' },
    { share: 0.9, at: '2026-10-02T18:00:00+05:30' },
    { share: 1, at: '2026-10-03T08:00:00+05:30' },
  ];

  get demoModels() {
    return [Shelter, OccupancyRecord, RescueTeam, ReliefStock, SupplyDistribution];
  }

  async run() {
    const district = await Uc03Seeder.#district();
    const organisations = await Uc03Seeder.#organisationIdsByName();
    const lead = await Uc03Seeder.#user(Uc03Seeder.#LEAD_EMAIL);
    const officer = await Uc03Seeder.#user(Uc03Seeder.#OFFICER_EMAIL);

    const shelters = new Map();
    for (const { name, location, capacity, currentOccupancy } of Uc03Seeder.#SHELTERS) {
      const shelter = await Shelter.findOneAndUpdate(
        { district, name },
        {
          $set: { location, capacity },
          $setOnInsert: { _id: Uc03Seeder.#idFor('shelter', name), currentOccupancy },
        },
        { upsert: true, runValidators: true, returnDocument: 'after' },
      );
      shelters.set(name, shelter._id);

      // A record is matched by its shelter and time, so re-seeding never
      // duplicates the history, and an officer's later updates are left alone.
      for (const { share, at } of Uc03Seeder.#OCCUPANCY_HISTORY) {
        await OccupancyRecord.findOneAndUpdate(
          { shelter: shelter._id, recordedAt: new Date(at) },
          {
            $setOnInsert: {
              _id: Uc03Seeder.#idFor('occupancy', name, at),
              district,
              occupants: Math.round(currentOccupancy * share),
              capacity,
              recordedBy: officer,
            },
          },
          { upsert: true, runValidators: true },
        );
      }
    }

    for (const { name, organisation, memberCount, base, ledByDemoLead } of Uc03Seeder.#TEAMS) {
      await RescueTeam.findOneAndUpdate(
        { district, name },
        {
          $set: {
            organisation: organisations.get(organisation),
            memberCount,
            baseLocation: base,
            lead: ledByDemoLead ? lead : null,
          },
          $setOnInsert: {
            _id: Uc03Seeder.#idFor('team', name),
            currentLocation: base,
            status: TeamStatus.AVAILABLE,
          },
        },
        { upsert: true, runValidators: true },
      );
    }

    const stock = new Map();
    for (const { organisation, supplyType, unit, quantityAvailable } of Uc03Seeder.#STOCK) {
      const row = await ReliefStock.findOneAndUpdate(
        { organisation: organisations.get(organisation), district, supplyType },
        {
          $set: { unit },
          $setOnInsert: {
            _id: Uc03Seeder.#idFor('stock', organisation, supplyType),
            quantityAvailable,
          },
        },
        { upsert: true, runValidators: true, returnDocument: 'after' },
      );
      stock.set(`${organisation}/${supplyType}`, row._id);
    }

    // A distribution is matched by what went where and when, so re-seeding
    // never logs it twice.
    for (const { organisation, supplyType, shelter, quantity, at } of Uc03Seeder.#DISTRIBUTIONS) {
      await SupplyDistribution.findOneAndUpdate(
        {
          shelter: shelters.get(shelter),
          stock: stock.get(`${organisation}/${supplyType}`),
          distributedAt: new Date(at),
        },
        {
          $setOnInsert: {
            _id: Uc03Seeder.#idFor('distribution', organisation, supplyType, shelter, at),
            organisation: organisations.get(organisation),
            supplyType,
            district,
            quantity,
            loggedBy: officer,
          },
        },
        { upsert: true, runValidators: true },
      );
    }

    console.log(
      `Seeded UC03: ${Uc03Seeder.#SHELTERS.length} shelters (${Uc03Seeder.#OCCUPANCY_HISTORY.length} occupancy records each), ${Uc03Seeder.#TEAMS.length} rescue teams, ` +
        `${Uc03Seeder.#STOCK.length} stock rows, ${Uc03Seeder.#DISTRIBUTIONS.length} supply logs`,
    );
  }

  // A record's id comes from its natural key, so --reset-demo recreates the
  // same ids and anything pointing at a seeded record still finds it. Only
  // used on insert: a record that already exists keeps the id it has.
  static #idFor(...key) {
    const hex = createHash('sha1')
      .update(['uc03', Uc03Seeder.#DISTRICT, ...key].join('|'))
      .digest('hex')
      .slice(0, 24);
    return new mongoose.Types.ObjectId(hex);
  }

  // The prerequisites are other seeders' records; a missing one stops the seed
  // rather than saving coordination data that points at nothing.
  static async #district() {
    const district = await District.findOne({ name: Uc03Seeder.#DISTRICT });
    if (!district) {
      throw new Error(
        `District "${Uc03Seeder.#DISTRICT}" is not seeded - run DistrictSeeder first`,
      );
    }
    return district._id;
  }

  static async #organisationIdsByName() {
    const names = [
      ...new Set([...Uc03Seeder.#TEAMS, ...Uc03Seeder.#STOCK].map((row) => row.organisation)),
    ];
    const found = await Organisation.find({ name: { $in: names } });
    const idsByName = new Map(found.map((organisation) => [organisation.name, organisation._id]));
    for (const name of names) {
      if (!idsByName.has(name)) {
        throw new Error(`Organisation "${name}" is not seeded - run OrganisationSeeder first`);
      }
    }
    return idsByName;
  }

  static async #user(email) {
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error(`Demo account ${email} is not seeded - run PeopleSeeder first`);
    }
    return user._id;
  }
}
