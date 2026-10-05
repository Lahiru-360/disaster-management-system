import mongoose from 'mongoose';
import { Coordinates } from '../src/domain/reports/Coordinates.js';
import { LocationSource } from '../src/enums/LocationSource.js';
import { ReportHazardType } from '../src/enums/ReportHazardType.js';
import { ReportStatus } from '../src/enums/ReportStatus.js';
import { District } from '../src/models/District.js';
import { HazardReport } from '../src/models/HazardReport.js';
import { User } from '../src/models/User.js';
import { ReferenceNumberGenerator } from '../src/services/ReferenceNumberGenerator.js';
import { systemClock } from '../src/utils/SystemClock.js';

// UC02 demo data: the duty officer's queue from the §5.2 wireframe, so the
// review screen has something to review on the first sign-in. Six PENDING
// reports in Colombo - a three-report Flood cluster near the Kolonnawa bridge
// ("GR-2481 Flood [3 similar]") plus one Landslide, one Blocked road and one
// Other - which the queue shows as the wireframe's four rows.
//
// Safe to re-run: each report is matched by its reference and only created
// when missing ($setOnInsert), so a report already reviewed in a rehearsal is
// left as it is. The reference counter is moved past GR-2481 so new
// submissions never reuse a seeded number. Expects an open connection and the
// districts and people already seeded - DatabaseSeeder owns all three.
export class Uc02Seeder {
  static #HIGHEST_SEEDED = 2481;

  // Oldest first: the Flood cluster's id is its first report's (GR-2474), so
  // it is created before the two that join it. `minutesAgo` is from seed time.
  static #REPORTS = [
    {
      referenceNo: 'GR-2470',
      hazardType: ReportHazardType.OTHER,
      description: 'Power line down across the lane after the storm',
      location: { latitude: 6.9147, longitude: 79.8778 },
      minutesAgo: 300,
      reporter: 'citizen.synth.3@example.test',
    },
    {
      referenceNo: 'GR-2474',
      hazardType: ReportHazardType.RISING_RIVER_FLOOD,
      description: 'Kelani river rising fast below the Kolonnawa bridge',
      location: { latitude: 6.9361, longitude: 79.8995 },
      minutesAgo: 50,
      reporter: 'citizen.synth.1@example.test',
      cluster: 'flood',
    },
    {
      referenceNo: 'GR-2476',
      hazardType: ReportHazardType.BLOCKED_ROAD,
      description: 'Baseline Road blocked by a fallen tree near the junction',
      location: { latitude: 6.9022, longitude: 79.8771 },
      minutesAgo: 180,
      reporter: 'volunteer@example.test',
    },
    {
      referenceNo: 'GR-2478',
      hazardType: ReportHazardType.RISING_RIVER_FLOOD,
      description: 'Water over the footpath next to the bridge',
      location: { latitude: 6.9375, longitude: 79.9031 },
      minutesAgo: 29,
      reporter: 'citizen.synth.2@example.test',
      cluster: 'flood',
    },
    {
      referenceNo: 'GR-2479',
      hazardType: ReportHazardType.LANDSLIDE,
      description: 'Crack opening on the slope above the houses',
      location: { latitude: 6.8536, longitude: 79.9846 },
      minutesAgo: 110,
      reporter: 'citizen.synth.4@example.test',
    },
    {
      referenceNo: 'GR-2481',
      hazardType: ReportHazardType.RISING_RIVER_FLOOD,
      description: 'Water level rising near the bridge',
      location: { latitude: 6.9382, longitude: 79.9012 },
      minutesAgo: 6,
      reporter: 'citizen@example.test',
      cluster: 'flood',
    },
  ];

  #clock;
  #referenceNumbers;

  constructor({ clock = systemClock, referenceNumbers = new ReferenceNumberGenerator() } = {}) {
    this.#clock = clock;
    this.#referenceNumbers = referenceNumbers;
  }

  async run() {
    const colombo = await District.findOne({ name: 'Colombo' });
    if (!colombo) {
      throw new Error('District "Colombo" is not seeded - run DistrictSeeder first');
    }
    const reporterIds = await Uc02Seeder.#reporterIdsByEmail();
    const now = this.#clock.now().getTime();
    const clusterIds = new Map();

    for (const { cluster, minutesAgo, reporter, location, ...fields } of Uc02Seeder.#REPORTS) {
      // A report alone in its cluster, or the first of one, is its own cluster.
      const id = new mongoose.Types.ObjectId();
      const doc = await HazardReport.findOneAndUpdate(
        { referenceNo: fields.referenceNo },
        {
          $setOnInsert: {
            _id: id,
            clusterId: (cluster && clusterIds.get(cluster)) ?? id,
            ...fields,
            reporter: reporterIds.get(reporter),
            photoUrl: `https://placehold.co/600x400/png?text=${fields.referenceNo}`,
            location: new Coordinates(location).toGeoJSON(),
            locationSource: LocationSource.GPS,
            district: colombo._id,
            status: ReportStatus.PENDING,
            submittedAt: new Date(now - minutesAgo * 60 * 1000),
          },
        },
        { upsert: true, returnDocument: 'after', runValidators: true },
      );
      if (cluster && !clusterIds.has(cluster)) {
        clusterIds.set(cluster, doc.clusterId);
      }
    }

    await this.#referenceNumbers.reserveUpTo(Uc02Seeder.#HIGHEST_SEEDED);
    console.log(`Seeded ${Uc02Seeder.#REPORTS.length} UC02 hazard reports`);
  }

  // A missing reporter means PeopleSeeder hasn't run, so the seed stops rather
  // than saving reports nobody submitted.
  static async #reporterIdsByEmail() {
    const emails = [...new Set(Uc02Seeder.#REPORTS.map((report) => report.reporter))];
    const users = await User.find({ email: { $in: emails } }).select('email');
    const ids = new Map(users.map((user) => [user.email, user._id]));
    for (const email of emails) {
      if (!ids.has(email)) {
        throw new Error(`Reporter "${email}" is not seeded - run PeopleSeeder first`);
      }
    }
    return ids;
  }
}
