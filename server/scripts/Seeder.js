// Base for every domain seeder that DatabaseSeeder runs. A subclass upserts its
// records by a natural key in run(), so a second seed changes nothing, and
// lists in demoModels the collections that `--reset-demo` may wipe before it
// runs. Expects an open connection - DatabaseSeeder owns it.
export class Seeder {
  constructor() {
    if (new.target === Seeder) {
      throw new Error('Seeder is abstract - extend it');
    }
  }

  /**
   * The key `--only=` selects this seeder by: the class name without
   * "Seeder", in kebab case (PeopleSeeder → people, Uc03Seeder → uc03,
   * HazardEventSeeder → hazard-event).
   * @returns {string}
   */
  get name() {
    return this.constructor.name
      .replace(/Seeder$/, '')
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .toLowerCase();
  }

  /**
   * The models whose collections hold this seeder's demo data, which
   * `--reset-demo` empties before the seeder runs again. Users and the
   * geography are never demo data: DatabaseSeeder refuses to wipe them.
   * @returns {import('mongoose').Model[]}
   */
  get demoModels() {
    return [];
  }

  /** Upserts this seeder's records. */
  async run() {
    throw new Error(`${this.constructor.name} must implement run()`);
  }
}
