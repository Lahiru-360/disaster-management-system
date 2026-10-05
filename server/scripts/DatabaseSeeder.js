import mongoose from 'mongoose';
import { env } from '../src/config/Config.js';
import { District } from '../src/models/District.js';
import { RiverBasin } from '../src/models/RiverBasin.js';
import { User } from '../src/models/User.js';
import { DistrictSeeder } from './DistrictSeeder.js';
import { HazardEventSeeder } from './HazardEventSeeder.js';
import { OrganisationSeeder } from './OrganisationSeeder.js';
import { PeopleSeeder } from './PeopleSeeder.js';
import { Uc01Seeder } from './Uc01Seeder.js';
import { Uc02Seeder } from './Uc02Seeder.js';
import { Uc03Seeder } from './Uc03Seeder.js';
import { Uc04Seeder } from './Uc04Seeder.js';

// Owns the connection and runs each domain seeder in order. Each seeder relies
// on the ones before it (people live in districts, the UC data points at
// people and districts), so `--only` runs a seeder on top of a database that
// was fully seeded before.
export class DatabaseSeeder {
  // Never emptied by --reset-demo: accounts are not demo data, and users and
  // basins point at districts by id, so reseeding the geography would orphan them.
  static #PROTECTED_MODELS = [User, District, RiverBasin];

  #seeders;

  /** @param {import('./Seeder.js').Seeder[]} [seeders] in the order they run */
  constructor(seeders = DatabaseSeeder.#defaultSeeders()) {
    this.#seeders = seeders;
  }

  /**
   * Reads the command-line flags: `--only=uc03` (or a comma-separated list)
   * and `--reset-demo`. An unknown flag stops the seed.
   * @param {string[]} args the arguments after the script name
   * @returns {{ only: string[] | null, resetDemo: boolean }}
   */
  static parseArgs(args) {
    const options = { only: null, resetDemo: false };
    for (const arg of args) {
      if (arg === '--reset-demo') {
        options.resetDemo = true;
      } else if (arg.startsWith('--only=')) {
        options.only = arg
          .slice('--only='.length)
          .split(',')
          .map((name) => name.trim())
          .filter(Boolean);
        if (options.only.length === 0) {
          throw new Error('--only needs at least one seeder name');
        }
      } else {
        throw new Error(`Unknown option "${arg}" - use --only=<names> or --reset-demo`);
      }
    }
    return options;
  }

  /**
   * Connects, seeds, and closes the connection even when a seeder fails.
   * @param {{ only?: string[] | null, resetDemo?: boolean }} [options]
   */
  async run(options = {}) {
    await mongoose.connect(env.mongoUri);
    try {
      await this.seed(options);
    } finally {
      await mongoose.connection.close();
    }
  }

  /**
   * Runs the selected seeders in order on the open connection. With
   * `resetDemo`, first empties the demo collections of those same seeders.
   * @param {{ only?: string[] | null, resetDemo?: boolean }} [options]
   */
  async seed({ only = null, resetDemo = false } = {}) {
    const seeders = this.#select(only);

    if (resetDemo) {
      await DatabaseSeeder.#wipeDemoData(seeders);
    }
    for (const seeder of seeders) {
      await seeder.run();
    }
  }

  // An unknown name is a typo, so nothing runs rather than a partial seed.
  #select(only) {
    if (!only) return this.#seeders;

    const names = this.#seeders.map((seeder) => seeder.name);
    const unknown = only.filter((name) => !names.includes(name));
    if (unknown.length > 0) {
      throw new Error(`Unknown seeder "${unknown.join(', ')}" - choose from ${names.join(', ')}`);
    }
    return this.#seeders.filter((seeder) => only.includes(seeder.name));
  }

  static async #wipeDemoData(seeders) {
    for (const seeder of seeders) {
      for (const Model of seeder.demoModels) {
        if (DatabaseSeeder.#PROTECTED_MODELS.includes(Model)) {
          throw new Error(`${seeder.constructor.name} may not reset ${Model.modelName}`);
        }
      }
    }

    for (const seeder of seeders) {
      for (const Model of seeder.demoModels) {
        const { deletedCount } = await Model.deleteMany({});
        console.log(`Reset ${Model.modelName}: removed ${deletedCount}`);
      }
    }
  }

  static #defaultSeeders() {
    return [
      new DistrictSeeder(),
      new PeopleSeeder(),
      new OrganisationSeeder(),
      new HazardEventSeeder(),
      new Uc01Seeder(),
      new Uc02Seeder(),
      new Uc03Seeder(),
      new Uc04Seeder(),
    ];
  }
}
