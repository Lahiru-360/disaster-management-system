import { OrgType } from '../src/enums/OrgType.js';
import { Organisation } from '../src/models/Organisation.js';
import { Seeder } from './Seeder.js';

// Seeds the organisations UC03 assigns stock and teams to and UC04 shares
// reports with. Safe to re-run: each is matched by name and updated in place
// ($set), so a corrected email reaches the database on the next seed. Reference
// data like the geography, so --reset-demo never empties it: UC records point
// at these by id. Expects an open connection - DatabaseSeeder owns it.
export class OrganisationSeeder extends Seeder {
  // contactEmail is set only for the organisations a report can be emailed to.
  static #ORGANISATIONS = [
    { name: 'SL Army', type: OrgType.ARMED_FORCES, contactEmail: null },
    { name: 'Sri Lanka Police', type: OrgType.POLICE, contactEmail: null },
    { name: 'Fire Service', type: OrgType.GOVERNMENT, contactEmail: null },
    { name: 'Government/DMC', type: OrgType.GOVERNMENT, contactEmail: null },
    {
      name: 'Red Cross Sri Lanka',
      type: OrgType.NGO,
      contactEmail: 'contact@redcross.lk.example.test',
    },
    { name: 'ADRA', type: OrgType.NGO, contactEmail: null },
    { name: 'UNICEF Sri Lanka', type: OrgType.DONOR, contactEmail: 'contact@unicef.example.test' },
  ];

  async run() {
    for (const organisation of OrganisationSeeder.#ORGANISATIONS) {
      await Organisation.findOneAndUpdate(
        { name: organisation.name },
        { $set: organisation },
        { upsert: true, runValidators: true },
      );
    }
    console.log(`Seeded ${OrganisationSeeder.#ORGANISATIONS.length} organisations`);
  }
}
