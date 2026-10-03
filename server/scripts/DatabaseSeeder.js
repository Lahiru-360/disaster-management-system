import mongoose from 'mongoose';
import { env } from '../src/config/Config.js';
import { DistrictSeeder } from './DistrictSeeder.js';
import { PeopleSeeder } from './PeopleSeeder.js';

// Owns the connection and runs each domain seeder in order.
export class DatabaseSeeder {
  async run() {
    await mongoose.connect(env.mongoUri);

    await new DistrictSeeder().run();
    await new PeopleSeeder().run();

    await mongoose.connection.close();
  }
}
