import { AlertHazardType } from '../src/enums/AlertHazardType.js';
import { EventStatus } from '../src/enums/EventStatus.js';
import { District } from '../src/models/District.js';
import { HazardEvent } from '../src/models/HazardEvent.js';
import { Seeder } from './Seeder.js';

// Seeds the hazard events (incidents): the CLOSED one UC04 reports on and the
// ACTIVE one UC03's dashboard opens against. Opening and closing an event is
// seed-only in this phase. Safe to re-run: each is matched by name and its
// fields set again, through save() so the model's status/endDate rules run.
// Reference data, so --reset-demo never empties it: alerts and dispatches point
// at these by id. Expects an open connection and the districts already seeded -
// DatabaseSeeder owns both.
export class HazardEventSeeder extends Seeder {
  // Dates are calendar days, stored as midnight UTC.
  static #EVENTS = [
    // UC04 §5.1 wireframe: "Kelani basin floods (8-20 Jun 2026)".
    {
      name: 'Kelani basin floods',
      hazardType: AlertHazardType.FLOOD,
      status: EventStatus.CLOSED,
      startDate: '2026-06-08',
      endDate: '2026-06-20',
      districts: ['Colombo', 'Gampaha', 'Kalutara'],
    },
    // UC03 hi-fi header: "Current Incident: Flood – Gampaha District".
    {
      name: 'Flood – Gampaha District',
      hazardType: AlertHazardType.FLOOD,
      status: EventStatus.ACTIVE,
      startDate: '2026-09-25',
      endDate: null,
      districts: ['Gampaha'],
    },
  ];

  async run() {
    const idsByName = await HazardEventSeeder.#districtIdsByName();

    for (const { name, startDate, endDate, districts, ...fields } of HazardEventSeeder.#EVENTS) {
      const event = (await HazardEvent.findOne({ name })) ?? new HazardEvent({ name });
      event.set({
        ...fields,
        startDate: new Date(startDate),
        endDate: endDate === null ? null : new Date(endDate),
        districts: districts.map((district) => idsByName.get(district)),
      });
      await event.save();
    }
    console.log(`Seeded ${HazardEventSeeder.#EVENTS.length} hazard events`);
  }

  // A missing district means DistrictSeeder hasn't run, so the seed stops
  // rather than saving an event that affects nowhere.
  static async #districtIdsByName() {
    const names = [...new Set(HazardEventSeeder.#EVENTS.flatMap((event) => event.districts))];
    const districts = await District.find({ name: { $in: names } });
    const idsByName = new Map(districts.map((district) => [district.name, district._id]));
    for (const name of names) {
      if (!idsByName.has(name)) {
        throw new Error(`District "${name}" is not seeded - run DistrictSeeder first`);
      }
    }
    return idsByName;
  }
}
